# シリアルまとめ

抽選応募のシリアルナンバーの紙を撮影して読み取り、応募先ごとにまとめる静的Webアプリ。まとめたシリアルを10件ずつコピーし、ブックマークレットで応募サイト（ticket.fortunemeets.app）の入力欄へ貼り付けられる。

**写真もシリアルも端末の外へ送らない。** 文字認識（PaddleOCR）はブラウザの中（WebAssembly）で動き、読み取ったシリアルはそのブラウザにだけ保存する。

## 開発

Node.js 24以上。

```sh
npm install
npm run dev        # http://localhost:5176
npm run build      # dist/ に出力
npx vite preview   # http://localhost:4176（Service Workerの確認は本番ビルドで）
npm test
npm run lint
npm run eval:ocr   # .local/fixtures/ の写真で読み取りを試す
```

作業の決まりは [AGENTS.md](AGENTS.md)、設計は [docs/](docs/) にある。

## ライセンス

使っているモデル・ライブラリのライセンスは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) にある。
