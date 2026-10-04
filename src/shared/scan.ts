/**
 * 紙に印刷された応募先の手がかり。読み取れなかったものは undefined。
 * 特定のアーティストや企画の形（「42ndシングル」など）を前提にしない。
 */
export interface EventRef {
  /** 紙に印刷された応募サイトのURLのアーティスト部分（例: `nogizaka46`） */
  artist?: string;
  /** 紙のタイトル（シリアルより上にある一番大きな文字の行）の読み取り結果 */
  title?: string;
}

/**
 * 応募先をどこから決めたか。
 * `paper` はシリアルと同じ紙のタイトル、`photo` は写真の中のタイトルが1種類だけだったので推定、
 * `none` は決められなかった。
 */
export type EventSource = "paper" | "photo" | "none";

/** RGBAの画素列。ImageData と同じ形で、Workerとの受け渡しに使う。 */
export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** 写真から読み取ったシリアル1件。 */
export interface ScannedSerial {
  serial: string;
  /** 文字認識の確信度（0〜1、文字ごとの平均） */
  conf: number;
  /** 最も自信の低い1文字の確信度。1文字だけの読み違いに気付くために使う */
  minCharConf: number;
  event: EventRef;
  eventSource: EventSource;
  /** 写真のシリアル部分の切り抜き。読み取り結果と見比べるためだけに使い、保存しない */
  thumb: Blob;
}

/** Workerが返すシリアル1件。切り抜きは画素のまま返し、画面側で画像にする。 */
export type WorkerSerial = Omit<ScannedSerial, "thumb"> & { thumb: Pixels };

/**
 * 画面からWorkerへの依頼。
 * 写真のデコードは画面側で行い、画素だけを渡す（Workerで画像を扱う OffscreenCanvas が使えないブラウザがあるため）。
 * `small` は文字の検出用に縮めた写真。
 */
export type WorkerRequest =
  | { type: "warmup" }
  | { type: "scan"; id: number; full: Pixels; small: Pixels };

/** Workerから画面への知らせ。 */
export type WorkerResponse =
  | { type: "loading"; progress: number }
  | { type: "ready" }
  | { type: "progress"; id: number; done: number; total: number }
  | { type: "result"; id: number; serials: WorkerSerial[] }
  | { type: "error"; id: number; message: string };

/** 応募サイトのURL。紙に印刷されたものと同じ形にする。 */
export function applyUrl(artist: string): string {
  return `https://ticket.fortunemeets.app/${artist}/`;
}

/** 比較用にタイトルから空白と記号を除く。読み取りのぶれで記号が増減しやすいため。 */
export function normalizeTitle(title: string): string {
  return title.replace(/[\s\p{P}\p{S}]/gu, "");
}

/** 2つの文字列の似ている度合い（0〜1）。レーベンシュタイン距離を長い方の長さで割る。 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return 1 - (prev[b.length] ?? 0) / Math.max(a.length, b.length);
}

/** タイトルが同じ応募先とみなす似ている度合い。読み取りのぶれ（1〜2文字の欠け）を吸収する。 */
const SAME_TITLE_SIMILARITY = 0.75;
/** 部分一致で比べる短い方のタイトルの最小の長さ。短すぎると何にでも一致してしまう。 */
const MIN_PARTIAL_LENGTH = 4;

/** 短い方を、長い方の同じ長さの部分と比べたときの最も高い似ている度合い。 */
function partialSimilarity(short: string, long: string): number {
  let best = 0;
  for (let i = 0; i + short.length <= long.length; i++) {
    best = Math.max(best, similarity(short, long.slice(i, i + short.length)));
  }
  return best;
}

/**
 * 2つのタイトルが同じ応募先か。
 * 重なった紙ではタイトルの一部しか読めないため、短い方が長い方の一部と似ていれば同じとみなす。
 * 「42nd」と「40th」のように数字だけが違うタイトルは文字列としては似ているが別の企画のため、
 * 数字は一方がもう一方に含まれることも求める。
 */
export function isSameTitle(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  const digitsShort = short.replace(/\D/g, "");
  const digitsLong = long.replace(/\D/g, "");
  if (!digitsLong.includes(digitsShort)) return false;
  if (similarity(short, long) >= SAME_TITLE_SIMILARITY) return true;
  return (
    short.length >= MIN_PARTIAL_LENGTH && partialSimilarity(short, long) >= SAME_TITLE_SIMILARITY
  );
}

/** アーティストが同じとみなす似ている度合い。URLの1〜2文字の読み違い（`nogi-aka46` など）を吸収する。 */
const SAME_ARTIST_SIMILARITY = 0.8;

/**
 * 2つのアーティストが同じか。どちらかが分からなければ同じとみなす。
 * タイトルだけでは「日向坂46 17th」と「乃木坂46 17th」を見分けにくいため、応募先を比べるときに併せて使う。
 */
export function isSameArtist(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return true;
  return similarity(a, b) >= SAME_ARTIST_SIMILARITY;
}
