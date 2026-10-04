import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { Plugin } from "vite";

/**
 * ビルドした全ファイルの一覧を埋め込んだ `sw.js` を出力する。
 * 2回目からは通信なしで動くよう、ファイルを端末にキャッシュする。
 */
export function serviceWorker(): Plugin {
  return {
    name: "serial-scanner:service-worker",
    apply: "build",
    generateBundle(_, bundle) {
      // public の中身（アイコン・manifest）はバンドルに含まれないため、別に数える
      const files = [...Object.keys(bundle), ...listFiles("public")].filter(
        (f) => !f.endsWith(".map"),
      );
      const version = createHash("sha256")
        .update(files.sort().join("\n"))
        .digest("hex")
        .slice(0, 12);
      // 文字認識のモデルは画面を開いたときにWorkerが取得し、そのときキャッシュに入る。
      // ここで先に取得すると、初回に同じ約30MBを2回ダウンロードしてしまう
      const precache = ["./", ...files.filter((f) => !/\.(onnx|wasm|txt)$/.test(f))];
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: swSource(version, precache, ["./", ...files]),
      });
    },
  };
}

function swSource(version: string, precache: string[], all: string[]) {
  return `// 自動生成（scripts/vite-service-worker.ts）。このサイトのファイルだけをキャッシュし、外部と通信しない。
const CACHE = "serial-scanner-${version}";
const PRECACHE = ${JSON.stringify(precache)};
const KNOWN = new Set(${JSON.stringify(all)}.map((f) => new URL(f, self.registration.scope).href));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 前の版のキャッシュのうち、今の版にもあるファイル（モデルなど）は引き継ぎ、ダウンロードし直さない
      for (const name of await caches.keys()) {
        if (name === CACHE) continue;
        const old = await caches.open(name);
        const current = await caches.open(CACHE);
        for (const req of await old.keys()) {
          if (KNOWN.has(req.url) && !(await current.match(req))) {
            const res = await old.match(req);
            if (res) await current.put(req, res);
          }
        }
        await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  const isPage = req.mode === "navigate";
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (isPage) {
        // 画面は新しい版を優先し、通信できないときだけキャッシュを使う
        try {
          const res = await fetch(req);
          if (res.ok) cache.put("./", res.clone());
          return res;
        } catch {
          return (await cache.match("./")) ?? Response.error();
        }
      }
      // ファイル名に内容のハッシュが付くため、キャッシュにあればそのまま使える
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && KNOWN.has(req.url)) cache.put(req, res.clone());
      return res;
    })(),
  );
});
`;
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).replaceAll("\\", "/"));
}
