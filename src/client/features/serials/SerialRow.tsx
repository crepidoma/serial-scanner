import { useState } from "react";
import { css, cx } from "styled-system/css";
import { Button } from "../../components/Button.tsx";
import { Icon } from "../../components/Icon.tsx";
import { ISSUE_TEXT, type SerialIssue } from "../../lib/checks.ts";
import {
  type Group,
  removeSerial,
  type SerialEntry,
  thumbOf,
  updateSerial,
} from "../../lib/store.ts";
import { serialInput } from "./styles.ts";

/**
 * シリアル1件の行。読み取った写真の切り抜きを並べ、目で見比べられるようにする。
 * `groups` を渡すと応募先を選ぶ欄を出す（応募先が分からないシリアル）。
 */
export function SerialRow({
  entry,
  index,
  issues,
  groups,
  onMove,
}: {
  entry: SerialEntry;
  index: number;
  issues: SerialIssue[];
  groups?: Group[];
  onMove?: (groupId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.serial);
  const [error, setError] = useState("");
  const thumb = thumbOf(entry.serial);

  const save = () => {
    const value = draft.trim();
    if (!value) return setError("シリアルを入力してください");
    if (updateSerial(entry.serial, value) === "duplicate") {
      return setError("同じシリアルがすでにあります");
    }
    setError("");
    setEditing(false);
  };

  return (
    <li
      className={cx(
        css({
          display: "grid",
          gap: "1.5",
          py: "2.5",
          borderTopWidth: "1px",
          borderColor: "line",
          _first: { borderTopWidth: "0" },
        }),
        issues.length > 0 && css({ bg: "warn.soft", mx: "-4", px: "4" }),
      )}
    >
      <div className={css({ display: "flex", alignItems: "center", gap: "2" })}>
        <span
          className={css({
            w: "7",
            flex: "none",
            fontSize: "sm",
            color: "text.muted",
            textAlign: "right",
          })}
        >
          {index + 1}.
        </span>
        {editing ? (
          <input
            className={serialInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\s/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && save()}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="シリアル"
          />
        ) : (
          <span
            className={css({
              flex: "1",
              minW: "0",
              fontFamily: "mono",
              fontSize: "xl",
              letterSpacing: "wider",
              overflowWrap: "anywhere",
              color: entry.copied ? "text.muted" : "text",
            })}
          >
            {entry.serial}
          </span>
        )}
        {entry.copied && !editing && (
          <span className={css({ color: "done", flex: "none" })} title="コピー済み">
            <Icon name="check" size={18} />
          </span>
        )}
        {editing ? (
          <>
            <Button size="sm" variant="primary" onClick={save}>
              保存する
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(entry.serial);
                setError("");
                setEditing(false);
              }}
            >
              やめる
            </Button>
          </>
        ) : (
          <>
            <Button size="icon" variant="ghost" aria-label="直す" onClick={() => setEditing(true)}>
              <Icon name="edit" size={18} />
            </Button>
            <Button
              size="icon"
              variant="ghostDanger"
              aria-label="削除する"
              onClick={() => removeSerial(entry.serial)}
            >
              <Icon name="trash" size={18} />
            </Button>
          </>
        )}
      </div>
      {thumb && (
        <img
          src={thumb}
          alt="写真のシリアル部分"
          className={css({
            ml: "9",
            maxW: "[calc(100% - 2.25rem)]",
            h: "11",
            objectFit: "contain",
            objectPosition: "left",
            borderRadius: "sm",
            borderWidth: "1px",
            borderColor: "line",
            bg: "white",
          })}
        />
      )}
      {error && <p className={css({ ml: "9", color: "danger", fontSize: "sm" })}>{error}</p>}
      {issues.map((issue) => (
        <p
          key={issue}
          className={css({
            ml: "9",
            display: "flex",
            alignItems: "center",
            gap: "1",
            color: "warn",
            fontSize: "sm",
            fontWeight: "bold",
          })}
        >
          <Icon name="warn" size={16} />
          {ISSUE_TEXT[issue]}
        </p>
      ))}
      {groups && onMove && (
        <label className={css({ ml: "9", display: "grid", gap: "1", fontSize: "sm" })}>
          応募先
          <select
            className={css({
              fontSize: "lg",
              minH: "11",
              px: "2",
              borderRadius: "sm",
              borderWidth: "1px",
              borderColor: "line.strong",
              bg: "surface",
              color: "text",
            })}
            value=""
            onChange={(e) => e.target.value && onMove(e.target.value)}
          >
            <option value="">選んでください</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </li>
  );
}
