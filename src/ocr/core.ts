// PP-OCR（文字の検出 → 傾きを直した切り出し → 文字の認識）。
// OpenCVを使うと読み込みが数MB増えるため、必要な幾何計算だけをここで書く。
import type * as Ort from "onnxruntime-web";

/** RGBAの画素列。ImageData と同じ形。 */
export interface RGBAImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** 2次元のベクトル・座標。 */
export type Vec = [number, number];

/**
 * 写真の中の文字の行。座標は元の写真のもの。
 * `u` は文字を読む向き、`v` は行の下向きの単位ベクトル。紙が回っていても、この2つで紙の上下が分かる。
 */
export interface TextLine {
  text: string;
  conf: number;
  minCharConf: number;
  /** 行の左上（読む向きで見たとき）の角 */
  p0: Vec;
  u: Vec;
  v: Vec;
  w: number;
  h: number;
  center: Vec;
}

/** 文字認識の確信度の目安。これより低い行は、上下を逆にして読み直す。 */
const FLIP_RETRY_CONF = 0.9;
/** 検出の閾値。PaddleOCRの既定値に合わせる。 */
const DET_THRESH = 0.3;
const BOX_THRESH = 0.5;
/** 検出した領域を広げる割合。小さいと文字の端が切れる。 */
const UNCLIP_RATIO = 1.6;
/** 先に読む「大きい行」の、行の高さの中央値に対する倍率。 */
const LARGE_LINE_RATIO = 1.2;
/** 認識モデルの入力の高さ。 */
const REC_HEIGHT = 48;

interface Box {
  p0: Vec;
  u: Vec;
  v: Vec;
  w: number;
  h: number;
}

function sampleRGB(img: RGBAImage, x: number, y: number, out: Float32Array, o: number) {
  const { data, width, height } = img;
  const cx = Math.min(Math.max(x, 0), width - 1.001);
  const cy = Math.min(Math.max(y, 0), height - 1.001);
  const x0 = cx | 0;
  const y0 = cy | 0;
  const fx = cx - x0;
  const fy = cy - y0;
  const i00 = (y0 * width + x0) * 4;
  const i10 = i00 + width * 4;
  for (let c = 0; c < 3; c++) {
    const top = data[i00 + c] * (1 - fx) + data[i00 + 4 + c] * fx;
    const bottom = data[i10 + c] * (1 - fx) + data[i10 + 4 + c] * fx;
    out[o + c] = top * (1 - fy) + bottom * fy;
  }
}

/** 回転した長方形を、高さ `outH` のまっすぐなRGB画像として切り出す。 */
export function cropRect(img: RGBAImage, box: Box, outH: number) {
  const { p0, u, v, w, h } = box;
  const scale = outH / h;
  const outW = Math.max(8, Math.round(w * scale));
  const buf = new Float32Array(outW * outH * 3);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const sx = x / scale;
      const sy = y / scale;
      const px = p0[0] + u[0] * sx + v[0] * sy;
      const py = p0[1] + u[1] * sx + v[1] * sy;
      sampleRGB(img, px, py, buf, (y * outW + x) * 3);
    }
  }
  return { buf, w: outW, h: outH };
}

/** 同じ長方形を180°回した向きにする（逆さまの紙を読むため）。 */
function flipBox(b: Box): Box {
  return {
    p0: [b.p0[0] + b.u[0] * b.w + b.v[0] * b.h, b.p0[1] + b.u[1] * b.w + b.v[1] * b.h],
    u: [-b.u[0], -b.u[1]],
    v: [-b.v[0], -b.v[1]],
    w: b.w,
    h: b.h,
  };
}

function convexHull(pts: Vec[]): Vec[] {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Vec, a: Vec, b: Vec) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec[] = [];
  const upper: Vec[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** 凸包を囲む最小面積の長方形（回転キャリパー法）。 */
function minAreaRect(hull: Vec[]) {
  let best:
    | { area: number; u: Vec; v: Vec; minU: number; maxU: number; minV: number; maxV: number }
    | undefined;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!len) continue;
    const u: Vec = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const v: Vec = [-u[1], u[0]];
    let minU = Number.POSITIVE_INFINITY;
    let maxU = Number.NEGATIVE_INFINITY;
    let minV = Number.POSITIVE_INFINITY;
    let maxV = Number.NEGATIVE_INFINITY;
    for (const p of hull) {
      const pu = p[0] * u[0] + p[1] * u[1];
      const pv = p[0] * v[0] + p[1] * v[1];
      minU = Math.min(minU, pu);
      maxU = Math.max(maxU, pu);
      minV = Math.min(minV, pv);
      maxV = Math.max(maxV, pv);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) best = { area, u, v, minU, maxU, minV, maxV };
  }
  return best;
}

/** 検出の確率マップから、文字の行を囲む回転した長方形を取り出す。 */
function boxesFromProbMap(prob: Float32Array, W: number, H: number, fx: number, fy: number): Box[] {
  const seen = new Uint8Array(W * H);
  const boxes: Box[] = [];
  const stack: number[] = [];
  const visit = (n: number) => {
    if (!seen[n] && prob[n] >= DET_THRESH) {
      seen[n] = 1;
      stack.push(n);
    }
  };
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || prob[i] < DET_THRESH) continue;
    const pts: Vec[] = [];
    let sum = 0;
    seen[i] = 1;
    stack.push(i);
    while (stack.length) {
      const k = stack.pop() as number;
      const x = k % W;
      const y = (k / W) | 0;
      pts.push([x, y]);
      sum += prob[k];
      if (x > 0) visit(k - 1);
      if (x < W - 1) visit(k + 1);
      if (y > 0) visit(k - W);
      if (y < H - 1) visit(k + W);
    }
    // 点のような小さな塊や、確率の低い塊は文字ではない
    if (pts.length < 20 || sum / pts.length < BOX_THRESH) continue;
    const r = minAreaRect(convexHull(pts));
    if (!r) continue;
    let w = r.maxU - r.minU + 1;
    let h = r.maxV - r.minV + 1;
    // 検出モデルは文字より細い領域を返すので、DBNetの方法で外側へ広げる
    const d = (w * h * UNCLIP_RATIO) / (2 * (w + h));
    let { u, v } = r;
    let minU = r.minU - d;
    let minV = r.minV - d;
    w += 2 * d;
    h += 2 * d;
    if (h > w) {
      // 縦長なら長い辺を読む向きにする（上下はあとで確信度から決める）
      const nu: Vec = v;
      const nv: Vec = [-u[0], -u[1]];
      const nMinU = minV;
      minV = -(minU + w);
      minU = nMinU;
      u = nu;
      v = nv;
      [w, h] = [h, w];
    }
    const p0: Vec = [(u[0] * minU + v[0] * minV) * fx, (u[1] * minU + v[1] * minV) * fy];
    boxes.push({ p0, u, v, w: w * fx, h: h * fy });
  }
  return boxes;
}

/** 文字認識の本体。モデルの読み込みは呼び出し側で行い、ブラウザとNode.jsの両方で使う。 */
export class OcrEngine {
  private readonly ort: typeof Ort;
  private readonly det: Ort.InferenceSession;
  private readonly rec: Ort.InferenceSession;
  private readonly dict: string[];

  constructor(
    ort: typeof Ort,
    det: Ort.InferenceSession,
    rec: Ort.InferenceSession,
    dict: string[],
  ) {
    this.ort = ort;
    this.det = det;
    this.rec = rec;
    this.dict = dict;
  }

  /**
   * 文字の行を検出する。
   * @param small 検出用に縮めた写真。大きいまま渡すと処理時間とメモリが増える
   * @param full 元の大きさの写真。返す座標はこの写真のもの
   */
  async detect(small: RGBAImage, full: RGBAImage): Promise<Box[]> {
    const W = Math.max(32, Math.round(small.width / 32) * 32);
    const H = Math.max(32, Math.round(small.height / 32) * 32);
    const sx = small.width / W;
    const sy = small.height / H;
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];
    const input = new Float32Array(3 * W * H);
    const px = new Float32Array(3);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        sampleRGB(small, (x + 0.5) * sx - 0.5, (y + 0.5) * sy - 0.5, px, 0);
        for (let c = 0; c < 3; c++) input[c * W * H + y * W + x] = (px[c] / 255 - mean[c]) / std[c];
      }
    }
    const tensor = new this.ort.Tensor("float32", input, [1, 3, H, W]);
    const out = await this.det.run({ [this.det.inputNames[0]]: tensor });
    const prob = out[this.det.outputNames[0]].data as Float32Array;
    return boxesFromProbMap(prob, W, H, full.width / W, full.height / H);
  }

  /** 切り出した1行を読む。CTCの出力を、同じ文字の連続と空白を除いてつなぐ。 */
  async recognize(crop: { buf: Float32Array; w: number; h: number }) {
    const { buf, w, h } = crop;
    const input = new Float32Array(3 * w * h);
    for (let i = 0; i < w * h; i++) {
      for (let c = 0; c < 3; c++) input[c * w * h + i] = (buf[i * 3 + c] / 255 - 0.5) / 0.5;
    }
    const tensor = new this.ort.Tensor("float32", input, [1, 3, h, w]);
    const out = await this.rec.run({ [this.rec.inputNames[0]]: tensor });
    const o = out[this.rec.outputNames[0]];
    const T = o.dims[1];
    const C = o.dims[2];
    const d = o.data as Float32Array;
    let text = "";
    let prev = 0;
    const confs: number[] = [];
    for (let t = 0; t < T; t++) {
      let mi = 0;
      let mv = -1;
      for (let c = 0; c < C; c++) {
        if (d[t * C + c] > mv) {
          mv = d[t * C + c];
          mi = c;
        }
      }
      if (mi !== 0 && mi !== prev) {
        text += this.dict[mi - 1] ?? "";
        confs.push(mv);
      }
      prev = mi;
    }
    const conf = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;
    const minCharConf = confs.length ? Math.min(...confs) : 0;
    return { text, conf, minCharConf };
  }

  /**
   * 写真1枚の文字の行を読む。
   * 説明文の細かい行まで読むと時間の大半をそこに使うため、まず文字の大きい行（シリアル・タイトル・URL）
   * だけを読む。`hasTarget` が大きい行の中に目的の行を見つけられなかったときだけ、残りの行も読む。
   */
  async scan(
    small: RGBAImage,
    full: RGBAImage,
    hasTarget: (lines: TextLine[]) => boolean,
    onProgress?: (done: number, total: number) => void,
  ): Promise<TextLine[]> {
    // 縦横比の小さい塊はQRコードや記号で、シリアル・タイトルではない
    const boxes = (await this.detect(small, full)).filter((b) => b.w / b.h >= 2 && b.h >= 10);
    const heights = boxes.map((b) => b.h).sort((a, b) => a - b);
    const median = heights[heights.length >> 1] ?? 0;
    // 試した紙では、説明文の行の高さが中央値になり、シリアル・タイトル・URLはその1.3倍以上だった
    const large = boxes.filter((b) => b.h >= median * LARGE_LINE_RATIO);
    const rest = boxes.filter((b) => b.h < median * LARGE_LINE_RATIO);
    const lines = await this.read(full, large, (done) => onProgress?.(done, large.length));
    if (hasTarget(lines) || rest.length === 0) return lines;
    return lines.concat(await this.read(full, rest, (done) => onProgress?.(done, rest.length)));
  }

  private async read(full: RGBAImage, boxes: Box[], onProgress: (done: number) => void) {
    const lines: TextLine[] = [];
    for (let i = 0; i < boxes.length; i++) {
      onProgress(i);
      let box = boxes[i];
      let r = await this.recognize(cropRect(full, box, REC_HEIGHT));
      // 逆さまの行は確信度がほぼ0になる。全行を両向きで読むと倍の時間がかかるため、低いときだけ読み直す
      if (r.conf < FLIP_RETRY_CONF) {
        const flipped = flipBox(box);
        const r2 = await this.recognize(cropRect(full, flipped, REC_HEIGHT));
        if (r2.conf > r.conf) {
          r = r2;
          box = flipped;
        }
      }
      if (!r.text) continue;
      const center: Vec = [
        box.p0[0] + (box.u[0] * box.w + box.v[0] * box.h) / 2,
        box.p0[1] + (box.u[1] * box.w + box.v[1] * box.h) / 2,
      ];
      lines.push({ ...r, ...box, center });
    }
    onProgress(boxes.length);
    return lines;
  }
}
