import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { minify } from "terser";
import type { Plugin } from "vite";

const SOURCE = new URL("../src/bookmarklet/bookmarklet.js", import.meta.url);
const ID = "virtual:bookmarklet";
const RESOLVED = `\0${ID}`;

/**
 * `virtual:bookmarklet` で、ブックマークレットのURL（`javascript:…`）と読みやすい元のコードを渡す。
 * 元のコードも画面に出し、外部へ何も送らないことを利用者が確かめられるようにする。
 */
export function bookmarklet(): Plugin {
  return {
    name: "serial-scanner:bookmarklet",
    resolveId(id) {
      return id === ID ? RESOLVED : undefined;
    },
    async load(id) {
      if (id !== RESOLVED) return;
      this.addWatchFile(fileURLToPath(SOURCE));
      const source = readFileSync(SOURCE, "utf8");
      const result = await minify(source, {
        compress: true,
        mangle: true,
        format: { comments: false },
      });
      if (!result.code) throw new Error("ブックマークレットを圧縮できませんでした");
      // URLとして解釈されるため、% や改行などを符号化する。日本語もそのままでは貼り付けで化けることがある
      const href = `javascript:${encodeURIComponent(result.code)}`;
      return `export const href = ${JSON.stringify(href)};\nexport const source = ${JSON.stringify(source)};\n`;
    },
  };
}
