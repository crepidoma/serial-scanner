import { href, source } from "virtual:bookmarklet";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../../components/Button.tsx";
import { Icon } from "../../components/Icon.tsx";
import { copyText } from "../../lib/clipboard.ts";
import { card } from "../serials/styles.ts";

const heading = css({ fontSize: "xl", fontWeight: "bold" });
const steps = css({ display: "grid", gap: "2", pl: "6", listStyleType: "decimal", fontSize: "md" });

/** ブックマークレットの登録のしかたと使い方。 */
export function BookmarkletPage() {
  const [copied, setCopied] = useState(false);
  return (
    <div className={css({ display: "grid", gap: "4" })}>
      <section className={card}>
        <h2 className={heading}>ブックマークレットとは</h2>
        <p className={css({ fontSize: "md" })}>
          ブックマークに登録して使う小さなプログラムです。応募サイトのシリアル登録の画面で開くと、
          このアプリでコピーしたシリアルを入力欄へまとめて入れます。
        </p>
        <ul
          className={css({
            display: "grid",
            gap: "1",
            pl: "5",
            listStyleType: "disc",
            fontSize: "md",
          })}
        >
          <li>
            入力欄へ入れるだけで、「シリアルナンバー登録」は押しません。内容を確かめてから、ご自身で押してください。
          </li>
          <li>
            シリアルをどこかへ送ることはありません。中身は下の「プログラムの中身」で確かめられます。
          </li>
        </ul>
      </section>

      <section className={card}>
        <h2 className={heading}>1. 登録する</h2>
        <h3 className={css({ fontSize: "lg", fontWeight: "bold" })}>パソコン</h3>
        <p className={css({ fontSize: "md" })}>
          下のボタンを、ブラウザのブックマークバーへドラッグしてください。
        </p>
        {/* React は javascript: のURLを href に渡すと無効にするため、DOMへ直接設定する */}
        {/* biome-ignore lint/a11y/useValidAnchor: ブックマークバーへドラッグして登録してもらうためのリンク */}
        <a
          ref={(el) => el?.setAttribute("href", href)}
          href="#bookmarklet"
          draggable
          // ドラッグで登録してもらうためのリンク。押されたら、ドラッグするよう知らせる
          onClick={(e) => {
            e.preventDefault();
            alert("このボタンはクリックではなく、ブックマークバーへドラッグして登録してください。");
          }}
          className={css({
            justifySelf: "start",
            display: "inline-flex",
            alignItems: "center",
            gap: "2",
            px: "4",
            minH: "11",
            borderRadius: "md",
            borderWidth: "2px",
            borderStyle: "dashed",
            borderColor: "accent",
            color: "accent",
            fontWeight: "bold",
            fontSize: "md",
            cursor: "grab",
          })}
        >
          <Icon name="bookmark" size={18} />
          シリアル貼り付け
        </a>

        <h3 className={css({ fontSize: "lg", fontWeight: "bold", mt: "2" })}>iPhone（Safari）</h3>
        <ol className={steps}>
          <li>下の「プログラムをコピー」を押す。</li>
          <li>
            画面下の共有ボタン（四角から矢印が出たもの）を押し、「ブックマークを追加」を選ぶ。
          </li>
          <li>名前を「シリアル貼り付け」にして「保存」を押す。</li>
          <li>ブックマークの一覧を開き、「編集」から今のブックマークを選ぶ。</li>
          <li>アドレスの欄を全部消して、コピーしたプログラムを貼り付け、「完了」を押す。</li>
        </ol>

        <h3 className={css({ fontSize: "lg", fontWeight: "bold", mt: "2" })}>Android（Chrome）</h3>
        <ol className={steps}>
          <li>下の「プログラムをコピー」を押す。</li>
          <li>右上の「︙」から「☆」を押してこのページをブックマークする。</li>
          <li>
            「編集」を押し、名前を「シリアル貼り付け」に、URLを全部消してコピーしたプログラムを貼り付ける。
          </li>
        </ol>

        <Button
          variant="primary"
          className={css({ justifySelf: "start" })}
          onClick={async () => setCopied(await copyText(href))}
        >
          <Icon name={copied ? "check" : "copy"} size={18} />
          {copied ? "コピーしました" : "プログラムをコピー"}
        </Button>
      </section>

      <section className={card}>
        <h2 className={heading}>2. 使う</h2>
        <ol className={steps}>
          <li>このアプリで「1〜10をコピー」を押す。</li>
          <li>応募サイトにログインし、シリアルナンバー登録の画面を開く。</li>
          <li>
            ブックマークから「シリアル貼り付け」を開く。
            <span className={css({ display: "block", fontSize: "sm", color: "text.secondary" })}>
              Androidでは、アドレスバーに「シリアル貼り付け」と入力し、出てきた候補を押します。
            </span>
          </li>
          <li>出てきた枠に貼り付けて「入力する」を押す。</li>
          <li>入力欄の内容を確かめて、「シリアルナンバー登録」を押す。</li>
        </ol>
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
          応募サイトでは、シリアルの登録に何度も失敗するとアカウントが一時的に使えなくなります。登録の前に、写真と見比べて確かめてください。
        </p>
      </section>

      <details className={card}>
        <summary className={css({ fontSize: "md", fontWeight: "bold", cursor: "pointer" })}>
          プログラムの中身
        </summary>
        <pre
          className={css({
            fontFamily: "mono",
            fontSize: "xs",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            maxH: "[60vh]",
            overflow: "auto",
          })}
        >
          {source}
        </pre>
      </details>
    </div>
  );
}
