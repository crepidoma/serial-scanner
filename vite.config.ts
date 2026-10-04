import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { bookmarklet } from "./scripts/vite-bookmarklet.ts";
import { serviceWorker } from "./scripts/vite-service-worker.ts";

/** 静的サイトのビルド設定。GitHub PagesのようにURLの途中に置かれても動くよう、相対パスで出力する。 */
export default defineConfig({
  base: "./",
  plugins: [react(), bookmarklet(), serviceWorker()],
  server: { port: 5176, strictPort: true },
  preview: { port: 4176, strictPort: true },
  worker: { format: "es" },
  resolve: {
    alias: {
      "styled-system": fileURLToPath(new URL("./styled-system", import.meta.url)),
    },
  },
  build: {
    // 文字認識のモデルは数MBあり、警告の既定値を超えるのは想定どおり
    chunkSizeWarningLimit: 1500,
    // .onnx・.wasm を data: URL に埋め込まず、別ファイルとしてキャッシュさせる
    assetsInlineLimit: 0,
  },
  assetsInclude: ["**/*.onnx"],
});
