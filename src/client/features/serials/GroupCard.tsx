import { useState } from "react";
import { css } from "styled-system/css";
import { applyUrl } from "../../../shared/scan.ts";
import { Button } from "../../components/Button.tsx";
import { Icon } from "../../components/Icon.tsx";
import { commonLength, issuesOf } from "../../lib/checks.ts";
import { copyText } from "../../lib/clipboard.ts";
import {
  addManualSerial,
  type Group,
  markCopied,
  removeGroup,
  renameGroup,
  type SerialEntry,
} from "../../lib/store.ts";
import { SerialRow } from "./SerialRow.tsx";
import { card, serialInput, textInput } from "./styles.ts";

/** 応募サイトが一度に受け付けるシリアルの数。コピーもこの単位で分ける。 */
const CHUNK = 10;

/** 応募先1つ分のシリアルの一覧と、10件ずつのコピー。 */
export function GroupCard({ group, serials }: { group: Group; serials: SerialEntry[] }) {
  const length = commonLength(serials);
  const issueCount = serials.filter((s) => issuesOf(s, length).length > 0).length;
  const chunks: SerialEntry[][] = [];
  for (let i = 0; i < serials.length; i += CHUNK) chunks.push(serials.slice(i, i + CHUNK));

  return (
    <section className={card} aria-label={group.label}>
      <GroupHeader group={group} count={serials.length} />
      {issueCount > 0 && (
        <p
          className={css({
            display: "flex",
            gap: "1.5",
            p: "3",
            borderRadius: "sm",
            bg: "warn.soft",
            color: "warn",
            fontSize: "md",
            fontWeight: "bold",
          })}
        >
          <Icon name="warn" />
          {issueCount}件の確認が必要です。写真の切り抜きと見比べて、違っていれば直してください。
        </p>
      )}
      <ol>
        {serials.map((s, i) => (
          <SerialRow key={s.serial} entry={s} index={i} issues={issuesOf(s, length)} />
        ))}
      </ol>
      <AddSerial groupId={group.id} />
      {chunks.length > 0 && (
        <div className={css({ display: "grid", gap: "2" })}>
          <p className={css({ fontSize: "sm", color: "text.secondary" })}>
            応募サイトには一度に10件まで登録できます。10件ずつコピーして、ブックマークレットで貼り付けてください。
          </p>
          <div className={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2" })}>
            {chunks.map((chunk, i) => (
              <CopyButton key={chunk[0]?.serial} chunk={chunk} start={i * CHUNK} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function GroupHeader({ group, count }: { group: Group; count: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.label);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (editing) {
    return (
      <div className={css({ display: "flex", gap: "2" })}>
        <input
          className={textInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="応募先の名前"
        />
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            renameGroup(group.id, draft);
            setEditing(false);
          }}
        >
          保存する
        </Button>
      </div>
    );
  }

  return (
    <div className={css({ display: "grid", gap: "2" })}>
      <div className={css({ display: "flex", alignItems: "flex-start", gap: "2" })}>
        <h2
          className={css({
            flex: "1",
            fontSize: "xl",
            fontWeight: "bold",
            overflowWrap: "anywhere",
          })}
        >
          {group.label}
          <span
            className={css({ ml: "2", fontSize: "md", color: "text.muted", fontWeight: "normal" })}
          >
            {count}件
          </span>
        </h2>
        <Button
          size="icon"
          variant="ghost"
          aria-label="名前を変える"
          onClick={() => setEditing(true)}
        >
          <Icon name="edit" size={18} />
        </Button>
      </div>
      <div className={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
        {group.artist && (
          <a
            href={applyUrl(group.artist)}
            target="_blank"
            rel="noreferrer"
            className={css({
              display: "inline-flex",
              alignItems: "center",
              gap: "1",
              color: "accent",
              fontWeight: "bold",
              fontSize: "md",
              minH: "9",
            })}
          >
            応募サイトを開く
            <Icon name="external" size={16} />
          </a>
        )}
        <span className={css({ flex: "1" })} />
        {confirmDelete ? (
          <>
            <Button size="sm" variant="danger" onClick={() => removeGroup(group.id)}>
              {count}件とも削除する
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              やめる
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghostDanger" onClick={() => setConfirmDelete(true)}>
            この応募先を削除
          </Button>
        )}
      </div>
      {confirmDelete && (
        <p className={css({ fontSize: "sm", color: "danger" })}>
          「{group.label}」とシリアル{count}件を削除します。元に戻せません。
        </p>
      )}
    </div>
  );
}

function CopyButton({ chunk, start }: { chunk: SerialEntry[]; start: number }) {
  const [message, setMessage] = useState("");
  const copied = chunk.every((s) => s.copied);
  const label = `${start + 1}〜${start + chunk.length}をコピー`;
  return (
    <div className={css({ display: "grid", gap: "1" })}>
      <Button
        variant={copied ? "secondary" : "primary"}
        onClick={async () => {
          const ok = await copyText(chunk.map((s) => s.serial).join("\n"));
          if (ok) markCopied(chunk.map((s) => s.serial));
          setMessage(ok ? "コピーしました" : "コピーできませんでした");
        }}
      >
        <Icon name={copied ? "check" : "copy"} size={18} />
        {label}
      </Button>
      <span
        role="status"
        className={css({ fontSize: "xs", color: "text.muted", textAlign: "center" })}
      >
        {message || (copied ? "コピー済み" : "")}
      </span>
    </div>
  );
}

function AddSerial({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  if (!open) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className={css({ justifySelf: "start" })}
        onClick={() => setOpen(true)}
      >
        <Icon name="plus" size={18} />
        手で追加する
      </Button>
    );
  }
  const add = () => {
    if (!draft) return setError("シリアルを入力してください");
    if (addManualSerial(draft, groupId) === "duplicate")
      return setError("同じシリアルがすでにあります");
    setDraft("");
    setError("");
  };
  return (
    <div className={css({ display: "grid", gap: "1" })}>
      <div className={css({ display: "flex", gap: "2" })}>
        <input
          className={serialInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\s/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && add()}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="シリアル"
          aria-label="追加するシリアル"
        />
        <Button size="sm" variant="primary" onClick={add}>
          追加する
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          閉じる
        </Button>
      </div>
      {error && <p className={css({ color: "danger", fontSize: "sm" })}>{error}</p>}
    </div>
  );
}
