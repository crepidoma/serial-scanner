# 公開

`npm run build` で `dist/` に静的ファイルを出力し、そのまま置く。サーバーの設定には頼らない（ヘッダーなしでも動く）。

## GitHub Pages（動作確認用）

`.github/workflows/pages.yml` が `main` へのpushでビルドし、GitHub Pagesへ公開する。

1. GitHubにリポジトリを作り、pushする。
2. リポジトリの Settings → Pages で、Source を「GitHub Actions」にする。
3. `https://<ユーザー名>.github.io/<リポジトリ名>/` で開く。

## Cloudflare Pages（本番）

1. Cloudflare Pages でGitHubのリポジトリをつなぐ。
2. ビルドの設定を次にする。
   - Build command: `npm run build`
   - Build output directory: `dist`
   - 環境変数 `NODE_VERSION`: `24`
3. 1ファイル25MBの上限があるが、最も大きいWASMでも約14MBで収まる。

## 公開後に確かめること

- iPhoneのSafariとAndroidのChromeで、初回の準備（約30MB）が終わり、写真を読み取れること。
- 機内モードで開き直しても読み取れること（Service Workerのキャッシュ）。
- ホーム画面に追加して開けること。
- ブックマークレットを登録し、応募サイトのシリアル登録の画面で入力欄へ入ること（登録ボタンは押さない）。
