/// <reference lib="webworker" />
// 文字認識のWeb Worker。モデルはこのサイトから読み込み、写真やシリアルをどこにも送らない。

import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import * as ort from "onnxruntime-web/wasm";
import detUrl from "../assets/models/det.onnx?url";
import keysUrl from "../assets/models/keys.txt?url";
import recUrl from "../assets/models/rec.onnx?url";
import type { Pixels, WorkerRequest, WorkerResponse, WorkerSerial } from "../shared/scan.ts";
import { cropRect, OcrEngine, type RGBAImage } from "./core.ts";
import { extractSerials, type FoundSerial, hasSerial } from "./parse.ts";

declare const self: DedicatedWorkerGlobalScope;

/** 進み具合の表示に使う、読み込むファイルのおよその合計（WASM・検出・認識・文字の一覧）。 */
const EXPECTED_BYTES = 14_300_000 + 4_750_000 + 10_830_000 + 30_000;

let enginePromise: Promise<OcrEngine> | undefined;

function post(msg: WorkerResponse) {
  self.postMessage(msg);
}

async function fetchWithProgress(url: string, onBytes: (n: number) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`読み込みに失敗しました（${res.status}）`);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    onBytes(value.length);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.length;
  }
  return buf;
}

function loadEngine(): Promise<OcrEngine> {
  enginePromise ??= (async () => {
    let loaded = 0;
    const onBytes = (n: number) => {
      loaded += n;
      post({ type: "loading", progress: Math.min(0.99, loaded / EXPECTED_BYTES) });
    };
    // WASMも自分で取得して渡す。onnxruntimeに任せると進み具合が分からないため
    const [wasm, det, rec, keys] = await Promise.all([
      fetchWithProgress(wasmUrl, onBytes),
      fetchWithProgress(detUrl, onBytes),
      fetchWithProgress(recUrl, onBytes),
      fetchWithProgress(keysUrl, onBytes),
    ]);
    ort.env.wasm.wasmBinary = wasm.buffer as ArrayBuffer;
    // 複数スレッドは、onnxruntimeの1ファイルにまとめた版をWorkerの中から使うと準備が終わらなくなったため使わない
    ort.env.wasm.numThreads = 1;
    const options: ort.InferenceSession.SessionOptions = { executionProviders: ["wasm"] };
    const detSession = await ort.InferenceSession.create(det, options);
    const recSession = await ort.InferenceSession.create(rec, options);
    // 辞書の末尾に空白を足すのはPaddleOCRの決まり（use_space_char）
    const dict = [...new TextDecoder().decode(keys).split(/\r?\n/), " "];
    post({ type: "ready" });
    return new OcrEngine(ort, detSession, recSession, dict);
  })();
  // 通信の失敗のあと、もう一度読み込めるようにする
  enginePromise.catch(() => {
    enginePromise = undefined;
  });
  return enginePromise;
}

/** シリアルの行の切り抜き。読み取り結果と見比べられるよう、少し余白を付ける。 */
function thumbnail(full: RGBAImage, s: FoundSerial): Pixels {
  const { line } = s;
  const pad = line.h * 0.15;
  const box = {
    p0: [
      line.p0[0] - line.u[0] * pad - line.v[0] * pad,
      line.p0[1] - line.u[1] * pad - line.v[1] * pad,
    ] as [number, number],
    u: line.u,
    v: line.v,
    w: line.w + pad * 2,
    h: line.h + pad * 2,
  };
  const crop = cropRect(full, box, 64);
  const data = new Uint8ClampedArray(crop.w * crop.h * 4);
  for (let i = 0; i < crop.w * crop.h; i++) {
    data[i * 4] = crop.buf[i * 3];
    data[i * 4 + 1] = crop.buf[i * 3 + 1];
    data[i * 4 + 2] = crop.buf[i * 3 + 2];
    data[i * 4 + 3] = 255;
  }
  return { data, width: crop.w, height: crop.h };
}

async function scan(id: number, full: Pixels, small: Pixels) {
  const engine = await loadEngine();
  const lines = await engine.scan(small, full, hasSerial, (done, total) =>
    post({ type: "progress", id, done, total }),
  );
  const serials: WorkerSerial[] = extractSerials(lines).map((s) => ({
    serial: s.serial,
    conf: s.conf,
    minCharConf: s.minCharConf,
    event: s.event,
    eventSource: s.eventSource,
    thumb: thumbnail(full, s),
  }));
  self.postMessage(
    { type: "result", id, serials } satisfies WorkerResponse,
    serials.map((s) => s.thumb.data.buffer),
  );
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  if (req.type === "warmup") {
    loadEngine().catch((err: unknown) => post({ type: "error", id: -1, message: String(err) }));
    return;
  }
  scan(req.id, req.full, req.small).catch((err: unknown) =>
    post({ type: "error", id: req.id, message: err instanceof Error ? err.message : String(err) }),
  );
};
