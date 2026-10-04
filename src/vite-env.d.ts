/// <reference types="vite/client" />

/** scripts/vite-bookmarklet.ts が作るモジュール。 */
declare module "virtual:bookmarklet" {
  /** ブックマークに登録するURL（`javascript:…`） */
  export const href: string;
  /** 読みやすい元のコード */
  export const source: string;
}
