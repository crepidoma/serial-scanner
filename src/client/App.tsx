import { useEffect, useState } from "react";
import { css } from "styled-system/css";
import { Button } from "./components/Button.tsx";
import { Icon } from "./components/Icon.tsx";
import { BookmarkletPage } from "./features/bookmarklet/BookmarkletPage.tsx";
import { ScanPanel } from "./features/scan/ScanPanel.tsx";
import { GroupCard } from "./features/serials/GroupCard.tsx";
import { UnassignedCard } from "./features/serials/UnassignedCard.tsx";
import { clearAll, useStore } from "./lib/store.ts";

/** 画面。ブックマークレットの説明は `#bookmarklet` で開く（静的ホスティングでも再読み込みで迷わないよう、ハッシュで切り替える）。 */
type Page = "scan" | "bookmarklet";

const pageFromHash = (): Page => (location.hash === "#bookmarklet" ? "bookmarklet" : "scan");

/** アプリ全体。 */
export function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  useEffect(() => {
    const onHash = () => {
      setPage(pageFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div
      className={css({
        maxW: "2xl",
        mx: "auto",
        px: "4",
        pt: "4",
        pb: "16",
        display: "grid",
        gap: "4",
      })}
    >
      <header className={css({ display: "grid", gap: "2" })}>
        <div className={css({ display: "flex", alignItems: "center", gap: "2" })}>
          {page === "bookmarklet" && (
            <a
              href="#scan"
              aria-label="戻る"
              className={css({
                display: "inline-flex",
                w: "11",
                h: "11",
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <Icon name="chevronLeft" />
            </a>
          )}
          <h1 className={css({ fontSize: "2xl", fontWeight: "bold" })}>
            {page === "scan" ? "シリアルまとめ" : "ブックマークレット"}
          </h1>
        </div>
        <PrivacyNote />
      </header>
      {page === "scan" ? <ScanPage /> : <BookmarkletPage />}
    </div>
  );
}

function PrivacyNote() {
  return (
    <p
      className={css({
        display: "flex",
        gap: "2",
        p: "3",
        borderRadius: "md",
        bg: "accent.soft",
        color: "text",
        fontSize: "sm",
      })}
    >
      <span className={css({ color: "accent" })}>
        <Icon name="lock" size={18} />
      </span>
      <span>
        <strong>写真もシリアルも、この端末の外へは送られません。</strong>
        読み取りはすべてこの端末の中で行い、読み取ったシリアルはこの端末のブラウザにだけ保存します。
      </span>
    </p>
  );
}

function ScanPage() {
  const { groups, serials } = useStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const unassigned = serials.filter((s) => s.groupId === null);
  const visibleGroups = groups.filter((g) => serials.some((s) => s.groupId === g.id));
  // 手で作った直後の応募先も、選択肢には出す
  const selectable = groups;

  return (
    <>
      <ScanPanel />
      {serials.length === 0 ? (
        <HowTo />
      ) : (
        <>
          {unassigned.length > 0 && <UnassignedCard serials={unassigned} groups={selectable} />}
          {visibleGroups.map((g) => (
            <GroupCard key={g.id} group={g} serials={serials.filter((s) => s.groupId === g.id)} />
          ))}
        </>
      )}
      <nav className={css({ display: "grid", gap: "3", mt: "2" })}>
        <a
          href="#bookmarklet"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "2",
            p: "4",
            borderRadius: "lg",
            borderWidth: "1px",
            borderColor: "line",
            bg: "surface",
            fontWeight: "bold",
            fontSize: "md",
          })}
        >
          <Icon name="bookmark" />
          応募サイトへ貼り付けるブックマークレット
        </a>
        {serials.length > 0 &&
          (confirmClear ? (
            <div className={css({ display: "grid", gap: "2" })}>
              <p className={css({ fontSize: "md", color: "danger" })}>
                読み取ったシリアル{serials.length}件をすべて削除します。元に戻せません。
              </p>
              <div className={css({ display: "flex", gap: "2" })}>
                <Button
                  variant="danger"
                  onClick={() => {
                    clearAll();
                    setConfirmClear(false);
                  }}
                >
                  すべて削除する
                </Button>
                <Button variant="ghost" onClick={() => setConfirmClear(false)}>
                  やめる
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghostDanger"
              className={css({ justifySelf: "start" })}
              onClick={() => setConfirmClear(true)}
            >
              すべて削除
            </Button>
          ))}
      </nav>
    </>
  );
}

function HowTo() {
  return (
    <section
      className={css({
        display: "grid",
        gap: "2",
        p: "4",
        borderRadius: "lg",
        borderWidth: "1px",
        borderColor: "line",
        borderStyle: "dashed",
        fontSize: "md",
      })}
    >
      <h2 className={css({ fontSize: "lg", fontWeight: "bold" })}>使い方</h2>
      <ol className={css({ display: "grid", gap: "1.5", pl: "6", listStyleType: "decimal" })}>
        <li>シリアルの紙を並べて撮るか、撮ってある写真を選びます。何枚でもまとめて選べます。</li>
        <li>
          読み取ったシリアルが応募先ごとに並びます。写真の切り抜きと見比べて、違っていれば直します。
        </li>
        <li>10件ずつコピーし、ブックマークレットで応募サイトの入力欄へ貼り付けます。</li>
      </ol>
      <p className={css({ fontSize: "sm", color: "text.secondary" })}>
        向きはバラバラでも読み取れます。シリアルの文字がはっきり写るように撮ってください。
      </p>
    </section>
  );
}
