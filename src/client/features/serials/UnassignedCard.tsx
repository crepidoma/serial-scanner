import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../../components/Button.tsx";
import { Icon } from "../../components/Icon.tsx";
import { issuesOf } from "../../lib/checks.ts";
import { createGroup, type Group, moveSerial, type SerialEntry } from "../../lib/store.ts";
import { SerialRow } from "./SerialRow.tsx";
import { cardStyle, textInput } from "./styles.ts";

/**
 * 応募先が分からないシリアル。紙のタイトルが写っておらず、写真の中の応募先が2種類以上あった場合に出る。
 * 応募先を選ぶと、その応募先の一覧へ移る。
 */
export function UnassignedCard({ serials, groups }: { serials: SerialEntry[]; groups: Group[] }) {
  const [name, setName] = useState("");
  return (
    <section
      className={css(cardStyle, { borderColor: "warn", borderWidth: "2px" })}
      aria-label="応募先が分からないシリアル"
    >
      <h2
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "2",
          fontSize: "xl",
          fontWeight: "bold",
          color: "warn",
        })}
      >
        <Icon name="warn" />
        応募先が分からないシリアル
        <span className={css({ fontSize: "md", fontWeight: "normal" })}>{serials.length}件</span>
      </h2>
      <p className={css({ fontSize: "md", color: "text.secondary" })}>
        紙のタイトルが写っていなかったシリアルです。それぞれ応募先を選んでください。
      </p>
      <ol>
        {serials.map((s, i) => (
          <SerialRow
            key={s.serial}
            entry={s}
            index={i}
            issues={issuesOf(s, undefined)}
            groups={groups}
            onMove={(groupId) => moveSerial(s.serial, groupId)}
          />
        ))}
      </ol>
      <div className={css({ display: "grid", gap: "1" })}>
        <p className={css({ fontSize: "sm", color: "text.secondary" })}>
          選びたい応募先がなければ、名前を付けて作れます。
        </p>
        <div className={css({ display: "flex", gap: "2" })}>
          <input
            className={textInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 42ndシングル"
            aria-label="新しい応募先の名前"
          />
          <Button
            size="sm"
            disabled={!name.trim()}
            onClick={() => {
              createGroup(name);
              setName("");
            }}
          >
            作る
          </Button>
        </div>
      </div>
    </section>
  );
}
