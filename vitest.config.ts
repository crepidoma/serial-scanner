import { defineConfig } from "vitest/config";

/** 共有の関数と、文字認識の結果の読み解きのテスト。どちらもNode.jsで動かす。 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
