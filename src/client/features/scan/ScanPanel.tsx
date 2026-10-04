import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../../components/Button.tsx";
import { Icon } from "../../components/Icon.tsx";
import { ocr } from "../../lib/ocr.ts";
import { addScanned } from "../../lib/store.ts";
import { card } from "../serials/styles.ts";

/** 読み取りの進み具合。 */
type Status =
  | { kind: "idle" }
  | { kind: "scanning"; index: number; total: number; ratio: number }
  | { kind: "done"; photos: number; added: number; duplicates: number; failed: number };

/** モデルの準備の進み具合。初回は約30MBを取得するため、割合を出して待てるようにする。 */
type ModelState = { kind: "loading"; progress: number } | { kind: "ready" } | { kind: "error" };

/** 写真を選ぶ・撮るボタンと、読み取りの進み具合。 */
export function ScanPanel() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [model, setModel] = useState<ModelState>({ kind: "loading", progress: 0 });

  useEffect(
    () =>
      ocr.subscribe((msg) => {
        if (msg.type === "loading") setModel({ kind: "loading", progress: msg.progress });
        if (msg.type === "ready") setModel({ kind: "ready" });
        if (msg.type === "error" && msg.id === -1) setModel({ kind: "error" });
      }),
    [],
  );

  const scanFiles = async (files: File[]) => {
    if (files.length === 0) return;
    let added = 0;
    let duplicates = 0;
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      setStatus({ kind: "scanning", index: i, total: files.length, ratio: 0 });
      try {
        const serials = await ocr.scan(file, (done, total) =>
          setStatus({
            kind: "scanning",
            index: i,
            total: files.length,
            ratio: total ? done / total : 0,
          }),
        );
        const r = addScanned(serials);
        added += r.added;
        duplicates += r.duplicates;
      } catch (err) {
        // 画面には件数だけを出す。原因はブラウザの開発者ツールで確かめられるよう残す
        console.error("写真を読み取れませんでした", err);
        failed++;
      }
    }
    setStatus({ kind: "done", photos: files.length, added, duplicates, failed });
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    // 同じ写真をもう一度選んでも change が起きるよう、選択を消しておく
    e.target.value = "";
    void scanFiles(files);
  };

  const busy = status.kind === "scanning";

  return (
    <section className={card} aria-label="写真の読み取り">
      <div className={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3" })}>
        <Button
          variant="primary"
          size="lg"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          <Icon name="camera" size={22} />
          カメラで撮る
        </Button>
        <Button size="lg" disabled={busy} onClick={() => filesRef.current?.click()}>
          <Icon name="image" size={22} />
          写真を選ぶ
        </Button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onChange}
      />
      <input ref={filesRef} type="file" accept="image/*" multiple hidden onChange={onChange} />

      {model.kind === "loading" && (
        <Progress
          label={`初回の準備中… ${Math.round(model.progress * 100)}%`}
          note="読み取りの仕組み（約30MB）をこの端末に保存しています。Wi-Fiでの利用をおすすめします。2回目からは通信なしで使えます。"
          ratio={model.progress}
        />
      )}
      {model.kind === "error" && (
        <p role="alert" className={css({ color: "danger", fontWeight: "bold", fontSize: "md" })}>
          読み取りの準備ができませんでした。通信を確かめて、ページを開き直してください。
        </p>
      )}
      {status.kind === "scanning" && (
        <Progress
          label={`${status.total}枚中${status.index + 1}枚目を読み取り中…`}
          ratio={(status.index + status.ratio) / status.total}
        />
      )}
      {status.kind === "done" && <DoneMessage {...status} />}
    </section>
  );
}

function Progress({ label, note, ratio }: { label: string; note?: string; ratio: number }) {
  return (
    <div role="status" className={css({ display: "grid", gap: "1.5" })}>
      <p className={css({ fontSize: "md", fontWeight: "bold" })}>{label}</p>
      <div className={css({ h: "2", bg: "line", borderRadius: "full", overflow: "hidden" })}>
        <div
          className={css({ h: "full", bg: "accent", transition: "[width 0.2s]" })}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      {note && <p className={css({ fontSize: "sm", color: "text.muted" })}>{note}</p>}
    </div>
  );
}

function DoneMessage({ photos, added, duplicates, failed }: Extract<Status, { kind: "done" }>) {
  const parts = [`${photos}枚の写真から${added}件のシリアルを読み取りました。`];
  if (duplicates > 0) parts.push(`${duplicates}件はすでに読み取り済みのため除きました。`);
  if (failed > 0) parts.push(`${failed}枚は読み取れませんでした。`);
  // 読み取れたが全部読み取り済みだった場合は、撮り直す必要がない
  if (added === 0 && duplicates === 0 && failed === 0) {
    parts.push("シリアルが大きく写るように、近づいて撮り直してください。");
  }
  return (
    <p role="status" className={css({ fontSize: "md", color: failed > 0 ? "warn" : "text" })}>
      {parts.join("")}
    </p>
  );
}
