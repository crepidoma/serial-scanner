import type {
  Pixels,
  ScannedSerial,
  WorkerRequest,
  WorkerResponse,
  WorkerSerial,
} from "../../shared/scan.ts";

/**
 * 読み取りに使う写真の長い辺の上限。iPhoneのSafariはcanvasの画素数に上限（約1,670万）があり、
 * 2400万画素の写真をそのまま描くと失敗するため縮める。4000pxでもシリアルの文字は十分な大きさに写る。
 */
const FULL_MAX_SIDE = 4000;
/** 文字の検出に使う写真の長い辺。試作では、これで紙10枚の写真のシリアルを読み切れた。 */
const DET_MAX_SIDE = 1920;

function draw(source: ImageBitmap, maxSide: number): Pixels {
  const s = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * s);
  canvas.height = Math.round(source.height * s);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("画像を読み込めませんでした");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // iOSはcanvasのメモリを解放するのが遅いため、大きさを0にして早めに手放す
  canvas.width = 0;
  canvas.height = 0;
  return { data, width, height };
}

function toBlob(p: Pixels): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = p.width;
  canvas.height = p.height;
  canvas
    .getContext("2d")
    ?.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.width, p.height), 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("切り抜きを作れませんでした"))),
      "image/jpeg",
      0.85,
    ),
  );
}

async function withBlobs(serials: WorkerSerial[]): Promise<ScannedSerial[]> {
  return Promise.all(serials.map(async (s) => ({ ...s, thumb: await toBlob(s.thumb) })));
}

type Listener = (msg: WorkerResponse) => void;

/**
 * 文字認識のWorkerを1つだけ持ち、写真を1枚ずつ順に渡す。
 * 同時に処理するとiPhoneでメモリが足りなくなるため、並べて待たせる。
 */
class OcrClient {
  private worker: Worker | undefined;
  private readonly listeners = new Set<Listener>();
  private nextId = 1;
  private queue: Promise<unknown> = Promise.resolve();

  private send(req: WorkerRequest, transfer: Transferable[] = []) {
    if (!this.worker) {
      this.worker = new Worker(new URL("../../ocr/worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        for (const l of this.listeners) l(e.data);
      };
    }
    this.worker.postMessage(req, transfer);
  }

  /** Workerからの知らせを受け取る。戻り値の関数で受け取りをやめる。 */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** モデルを先に読み込んでおく。初回はここで約30MBを取得する。 */
  warmup() {
    this.send({ type: "warmup" });
  }

  /** 写真1枚を読み取る。前の写真が終わるまで待ってから始める。 */
  scan(file: Blob, onProgress?: (done: number, total: number) => void): Promise<ScannedSerial[]> {
    const run = async () => {
      // createImageBitmap はEXIFの向きを反映する（スマホの縦向きの写真が横にならない）
      const bitmap = await createImageBitmap(file);
      const full = draw(bitmap, FULL_MAX_SIDE);
      const small = draw(bitmap, DET_MAX_SIDE);
      bitmap.close();
      const serials = await new Promise<WorkerSerial[]>((resolve, reject) => {
        const id = this.nextId++;
        const off = this.subscribe((msg) => {
          if (msg.type === "progress" && msg.id === id) onProgress?.(msg.done, msg.total);
          if (msg.type === "result" && msg.id === id) {
            off();
            resolve(msg.serials);
          }
          if (msg.type === "error" && msg.id === id) {
            off();
            reject(new Error(msg.message));
          }
        });
        this.send({ type: "scan", id, full, small }, [full.data.buffer, small.data.buffer]);
      });
      return withBlobs(serials);
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }
}

/** アプリ全体で使う文字認識。 */
export const ocr = new OcrClient();
