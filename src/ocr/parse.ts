// 写真1枚の文字の行から、シリアルとその応募先の手がかりを取り出す。
import { type EventRef, type EventSource, isSameTitle } from "../shared/scan.ts";
import type { TextLine } from "./core.ts";

/** 写真から取り出したシリアル1件と、その行の位置。 */
export interface FoundSerial {
  serial: string;
  conf: number;
  minCharConf: number;
  event: EventRef;
  eventSource: EventSource;
  line: TextLine;
}

const compact = (s: string) => s.replace(/\s+/g, "");

/**
 * シリアルらしい行か。英大文字と数字だけの10〜20文字とする。
 * 説明文の中の型番（`SRCL13790` など）は、前後の文字とつながって読まれるため長さで外れる。
 */
export function isSerial(text: string): boolean {
  return /^[A-Z0-9]{10,20}$/.test(compact(text));
}

/** シリアルらしい行が1つでもあるか。 */
export const hasSerial = (lines: TextLine[]) => lines.some((l) => isSerial(l.text));

/**
 * 紙に印刷された応募サイトのURLから、アーティスト部分を取り出す。
 * 重なった紙ではURLが途中で切れて読まれるため、末尾の「/」まで読めたものだけを使う。
 */
export function findArtist(text: string): string | undefined {
  const m = /fortune(?:meets|music)\.app\/([a-z0-9_-]+)\//i.exec(compact(text));
  return m?.[1]?.toLowerCase();
}

/**
 * シリアルから紙のタイトルまでの距離の上限（シリアルの行の高さの倍数）。
 * 試した紙ではおよそ12〜15倍。広げすぎると、上に並べた別の紙のタイトルを拾う。
 */
const TITLE_RANGE = 18;

const isUrlLine = (text: string) => /https?:|\.app|\.com|\.jp/i.test(text);

/** シリアルより上にある行。`up` はシリアルから上への距離、`distance` は横のずれも加えた距離。 */
interface Above {
  line: TextLine;
  up: number;
  distance: number;
}

/**
 * 同じ紙の上で、シリアルより上にある行を探す。
 * 紙が回っていても判定できるよう、シリアルの行の向き（u・v）を基準にした座標で比べる。
 */
function linesAbove(serial: TextLine, lines: TextLine[], range: number): Above[] {
  const result: Above[] = [];
  for (const l of lines) {
    // 向きの違う行は別の紙
    if (l.u[0] * serial.u[0] + l.u[1] * serial.u[1] < 0.8) continue;
    const dx = l.center[0] - serial.center[0];
    const dy = l.center[1] - serial.center[1];
    const along = dx * serial.u[0] + dy * serial.u[1];
    const across = dx * serial.v[0] + dy * serial.v[1];
    // 横に並べた隣の紙のタイトルを拾わないよう、横のずれはシリアルの行の幅より小さく抑える
    if (across >= 0 || -across > serial.h * range || Math.abs(along) > serial.w * 0.8) continue;
    result.push({ line: l, up: -across, distance: -across + Math.abs(along) * 0.5 });
  }
  return result;
}

/**
 * 紙のタイトル。タイトルは紙の一番上にある、文字の大きい数行のまとまりで、その1行目を使う。
 * 上から順に、すぐ下に大きな行が続いている行を探す。上に重なった別の紙の注意書きのように、
 * 1行だけ離れてある行はタイトルではないため飛ばす。
 */
function findTitle(serial: TextLine, lines: TextLine[]): string | undefined {
  const candidates = linesAbove(serial, lines, TITLE_RANGE).filter(
    ({ line }) => !isUrlLine(line.text) && compact(line.text).length >= 3,
  );
  const maxH = Math.max(0, ...candidates.map(({ line }) => line.h));
  // 説明文より大きい行だけを候補にする。斜めの写真では行の高さが大きめに出るため緩めにする
  const large = candidates.filter(({ line }) => line.h >= maxH * 0.75).sort((a, b) => b.up - a.up);
  // タイトルの行間は行の高さの1.2倍ほど
  const followed = (c: Above) =>
    large.some((d) => c.up - d.up > 0 && c.up - d.up <= ((c.line.h + d.line.h) / 2) * 1.8);
  const top = large.find(followed) ?? large[0];
  return top && compact(top.line.text);
}

function nearestArtist(serial: TextLine, lines: TextLine[]): string | undefined {
  let best: { artist: string; distance: number } | undefined;
  for (const { line, distance } of linesAbove(serial, lines, TITLE_RANGE)) {
    const artist = findArtist(line.text);
    if (artist && (!best || distance < best.distance)) best = { artist, distance };
  }
  return best?.artist;
}

/** 似たタイトルを1つにまとめた種類。写真の中の応募先が1種類かどうかの判定に使う。 */
function distinctTitles(titles: string[]): string[] {
  const kinds: string[] = [];
  for (const t of titles) if (!kinds.some((k) => isSameTitle(k, t))) kinds.push(t);
  return kinds;
}

/** 写真1枚の行から、シリアルを読み順（上から、同じ高さなら左から）に取り出す。 */
export function extractSerials(lines: TextLine[]): FoundSerial[] {
  const serialLines = lines.filter((l) => isSerial(l.text));
  const infoLines = lines.filter((l) => !isSerial(l.text));

  const found = serialLines.map((line) => ({
    line,
    title: findTitle(line, infoLines),
    artist: nearestArtist(line, infoLines),
  }));

  // タイトルの隠れた紙は、写真の中の応募先が1種類だけならそれとみなす
  const titles = distinctTitles(found.flatMap((f) => (f.title ? [f.title] : [])));
  const artists = [...new Set(infoLines.flatMap((l) => findArtist(l.text) ?? []))];
  const photoTitle = titles.length === 1 ? titles[0] : undefined;
  const photoArtist = artists.length === 1 ? artists[0] : undefined;

  const result: FoundSerial[] = [];
  const seen = new Set<string>();
  for (const f of found) {
    const serial = compact(f.line.text);
    if (seen.has(serial)) continue;
    seen.add(serial);
    let eventSource: EventSource = f.title ? "paper" : "none";
    let title = f.title;
    if (!title && photoTitle) {
      title = photoTitle;
      eventSource = "photo";
    }
    result.push({
      serial,
      conf: f.line.conf,
      minCharConf: f.line.minCharConf,
      event: { artist: f.artist ?? photoArtist, title },
      eventSource,
      line: f.line,
    });
  }
  // 同じ段とみなす高さの差は、シリアルの文字の高さの2倍まで
  result.sort((a, b) => {
    const dy = a.line.center[1] - b.line.center[1];
    return Math.abs(dy) > a.line.h * 2 ? dy : a.line.center[0] - b.line.center[0];
  });
  return result;
}
