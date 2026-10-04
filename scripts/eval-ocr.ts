// 手元の写真で読み取りを試し、シリアルと応募先の手がかりを表示する（ブラウザと同じ処理をNode.jsで動かす）。
// 使い方: npm run eval:ocr -- [写真のパス...]   省くと .local/fixtures/*.jpg
// 実物のシリアルが写った写真はGitに入れず、.local/ に置く。
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as ort from "onnxruntime-node";
import sharp from "sharp";
import { OcrEngine, type RGBAImage } from "../src/ocr/core.ts";
import { extractSerials, hasSerial, isSerial } from "../src/ocr/parse.ts";

const MODELS = "src/assets/models";
const DET_MAX_SIDE = 1920;
const verbose = process.argv.includes("--verbose");

async function load(path: string, maxSide?: number): Promise<RGBAImage> {
  let img = sharp(path).rotate();
  if (maxSide)
    img = img.resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true });
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
}

const det = await ort.InferenceSession.create(join(MODELS, "det.onnx"));
const rec = await ort.InferenceSession.create(join(MODELS, "rec.onnx"));
const dict = [...readFileSync(join(MODELS, "keys.txt"), "utf8").split(/\r?\n/), " "];
// onnxruntime-node と -web は同じAPIのため、型だけ -web のものとして渡す
const engine = new OcrEngine(ort as never, det as never, rec as never, dict);

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const files = args.length
  ? args
  : readdirSync(".local/fixtures")
      .filter((f) => /\.(jpe?g|png)$/i.test(f))
      .map((f) => join(".local/fixtures", f));

for (const file of files) {
  const full = await load(file);
  const small = await load(file, DET_MAX_SIDE);
  const t0 = performance.now();
  const lines = await engine.scan(small, full, hasSerial);
  const ms = Math.round(performance.now() - t0);
  const found = extractSerials(lines);
  console.log(`\n# ${file}  ${lines.length}行 ${ms}ms`);
  for (const s of found) {
    const ev = `${s.event.artist ?? "?"} / ${s.event.title ?? "?"} (${s.eventSource})`;
    console.log(`  ${s.serial}  conf=${s.conf.toFixed(3)} min=${s.minCharConf.toFixed(3)}  ${ev}`);
  }
  if (verbose) {
    for (const l of lines) {
      if (isSerial(l.text)) continue;
      const c = l.center.map(Math.round).join(",");
      console.log(`    h=${Math.round(l.h)} @${c} u=${l.u.map((v) => v.toFixed(2))} ${l.text}`);
    }
  }
}
