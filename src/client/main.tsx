import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { ocr } from "./lib/ocr.ts";

const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * Service Workerを登録してから、文字認識のモデルを読み込み始める。
 * 先にモデルを取得すると、その通信がService Workerを通らずキャッシュに入らないため。
 */
async function start() {
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./sw.js");
      if (!navigator.serviceWorker.controller) {
        // 初回は登録した直後の Service Worker がこのページを制御し始めるまで待つ（長くは待たない）
        await Promise.race([
          new Promise((r) =>
            navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }),
          ),
          new Promise((r) => setTimeout(r, 3000)),
        ]);
      }
    } catch {
      // Service Workerが使えなくても、オフラインで使えないだけで読み取りはできる
    }
  }
  ocr.warmup();
}

void start();
