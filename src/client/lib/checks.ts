import type { SerialEntry } from "./store.ts";

/** 文字認識の確信度がこれ未満なら、写真と見比べるよう促す。 */
const LOW_CONF = 0.9;
/** 1文字でもこれ未満なら、その文字の読み違いを疑う。 */
const LOW_CHAR_CONF = 0.8;

/** シリアルに付ける注意。応募サイトは登録の失敗が続くとアカウントを一時停止するため、送る前に気付かせる。 */
export type SerialIssue = "lowConfidence" | "length" | "chars";

/** 同じ応募先のシリアルの中で、最も多い桁数。 */
export function commonLength(serials: SerialEntry[]): number | undefined {
  const counts = new Map<number, number>();
  for (const s of serials) counts.set(s.serial.length, (counts.get(s.serial.length) ?? 0) + 1);
  let best: [number, number] | undefined;
  for (const entry of counts) if (!best || entry[1] > best[1]) best = entry;
  // 1〜2件では多数派と言えないため判定しない
  return best && best[1] >= 2 && best[1] > serials.length / 2 ? best[0] : undefined;
}

/** シリアル1件の注意。 */
export function issuesOf(entry: SerialEntry, length: number | undefined): SerialIssue[] {
  const issues: SerialIssue[] = [];
  if (!/^[A-Za-z0-9]+$/.test(entry.serial)) issues.push("chars");
  if (length !== undefined && entry.serial.length !== length) issues.push("length");
  if (entry.conf < LOW_CONF || entry.minCharConf < LOW_CHAR_CONF) issues.push("lowConfidence");
  return issues;
}

/** 注意の説明。 */
export const ISSUE_TEXT: Record<SerialIssue, string> = {
  lowConfidence: "読み取りに自信がありません。写真と見比べてください",
  length: "ほかのシリアルと桁数が違います",
  chars: "英数字以外の文字が入っています",
};
