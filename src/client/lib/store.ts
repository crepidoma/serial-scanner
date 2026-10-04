import { useSyncExternalStore } from "react";
import {
  type EventSource,
  isSameArtist,
  isSameTitle,
  type ScannedSerial,
} from "../../shared/scan.ts";

/** 応募先。紙のタイトルごとに1つ作る。 */
export interface Group {
  id: string;
  /** 画面に出す名前。最初は紙のタイトルの読み取り結果で、利用者が付け直せる */
  label: string;
  /** 応募サイトのURLのアーティスト部分。紙ごとの読み取り結果の多数決で決める */
  artist?: string;
  /** アーティスト部分の読み取り結果ごとの件数。重なった紙ではURLを読み違えることがあるため数えておく */
  artistVotes?: Record<string, number>;
  /** 同じ応募先かを比べるためのタイトル。名前を付け直しても読み取り結果のまま残す */
  titleKey?: string;
}

/** シリアル1件。 */
export interface SerialEntry {
  serial: string;
  /** 応募先。分からないときは null */
  groupId: string | null;
  /** 文字認識の確信度。手で入力・修正したものは 1 */
  conf: number;
  minCharConf: number;
  source: EventSource | "manual";
  /** 10件ずつのコピーで、コピー済みになったか */
  copied: boolean;
  addedAt: number;
}

/** 端末に保存する内容。写真と切り抜きは保存しない。 */
export interface State {
  groups: Group[];
  serials: SerialEntry[];
}

const STORAGE_KEY = "serial-scanner:v1";

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      return { groups: parsed.groups ?? [], serials: parsed.serials ?? [] };
    }
  } catch {
    // プライベートブラウズなどで保存できない場合は、保存なしで使う
  }
  return { groups: [], serials: [] };
}

let state: State = load();
const listeners = new Set<() => void>();
/** シリアルごとの切り抜き画像（object URL）。端末にも保存しない。 */
const thumbs = new Map<string, string>();

function setState(next: State) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 保存できなくても画面の操作は続けられる
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** 保存している状態を読む。 */
export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state);
}

/** シリアルの切り抜き画像のURL。読み取った直後だけある。 */
export function thumbOf(serial: string): string | undefined {
  return thumbs.get(serial);
}

const newId = () => crypto.randomUUID();

/** タイトルとアーティストが合う既存の応募先を探す。 */
function findGroup(groups: Group[], title: string, artist: string | undefined) {
  return groups.find(
    (g) => g.titleKey && isSameTitle(title, g.titleKey) && isSameArtist(artist, g.artist),
  );
}

/** アーティストの読み取り結果を1票加え、最も多いものを応募先のアーティストにする。 */
function voteArtist(group: Group, artist: string | undefined): Group {
  if (!artist) return group;
  const votes = { ...group.artistVotes, [artist]: (group.artistVotes?.[artist] ?? 0) + 1 };
  const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0];
  return { ...group, artistVotes: votes, artist: top };
}

/** 読み取り結果を加える結果。 */
export interface AddResult {
  added: number;
  /** すでにあったシリアルの数 */
  duplicates: number;
}

/** 写真1枚の読み取り結果を加える。同じシリアルは1つにまとめる。 */
export function addScanned(scanned: ScannedSerial[]): AddResult {
  const groups = [...state.groups];
  const serials = [...state.serials];
  const existing = new Set(serials.map((s) => s.serial));
  let added = 0;
  let duplicates = 0;
  const now = Date.now();
  for (const s of scanned) {
    if (existing.has(s.serial)) {
      duplicates++;
      continue;
    }
    existing.add(s.serial);
    let groupId: string | null = null;
    const { title, artist } = s.event;
    if (title) {
      let group = findGroup(groups, title, artist);
      if (!group) {
        group = { id: newId(), label: title, titleKey: title };
        groups.push(group);
      }
      const voted = voteArtist(group, artist);
      groups[groups.indexOf(group)] = voted;
      groupId = voted.id;
    }
    thumbs.set(s.serial, URL.createObjectURL(s.thumb));
    serials.push({
      serial: s.serial,
      groupId,
      conf: s.conf,
      minCharConf: s.minCharConf,
      source: s.eventSource,
      copied: false,
      addedAt: now + added,
    });
    added++;
  }
  setState({ groups, serials });
  return { added, duplicates };
}

/** シリアルを手で直す。直したものは確かめ済みとして扱う。 */
export function updateSerial(serial: string, next: string): "ok" | "duplicate" {
  const value = next.trim();
  if (value !== serial && state.serials.some((s) => s.serial === value)) return "duplicate";
  const thumb = thumbs.get(serial);
  if (thumb && value !== serial) {
    thumbs.delete(serial);
    thumbs.set(value, thumb);
  }
  setState({
    ...state,
    serials: state.serials.map((s) =>
      s.serial === serial ? { ...s, serial: value, conf: 1, minCharConf: 1, copied: false } : s,
    ),
  });
  return "ok";
}

/** シリアルを手で加える。 */
export function addManualSerial(serial: string, groupId: string | null): "ok" | "duplicate" {
  const value = serial.trim();
  if (state.serials.some((s) => s.serial === value)) return "duplicate";
  setState({
    ...state,
    serials: [
      ...state.serials,
      {
        serial: value,
        groupId,
        conf: 1,
        minCharConf: 1,
        source: "manual",
        copied: false,
        addedAt: Date.now(),
      },
    ],
  });
  return "ok";
}

export function removeSerial(serial: string) {
  const thumb = thumbs.get(serial);
  if (thumb) URL.revokeObjectURL(thumb);
  thumbs.delete(serial);
  setState({ ...state, serials: state.serials.filter((s) => s.serial !== serial) });
}

/** シリアルの応募先を変える。 */
export function moveSerial(serial: string, groupId: string | null) {
  setState({
    ...state,
    serials: state.serials.map((s) => (s.serial === serial ? { ...s, groupId } : s)),
  });
}

/** 応募先を手で作る。 */
export function createGroup(label: string): Group {
  const group: Group = { id: newId(), label: label.trim() };
  setState({ ...state, groups: [...state.groups, group] });
  return group;
}

export function renameGroup(id: string, label: string) {
  setState({
    ...state,
    groups: state.groups.map((g) => (g.id === id ? { ...g, label: label.trim() || g.label } : g)),
  });
}

/** 応募先とそのシリアルを消す。 */
export function removeGroup(id: string) {
  for (const s of state.serials) {
    if (s.groupId !== id) continue;
    const thumb = thumbs.get(s.serial);
    if (thumb) URL.revokeObjectURL(thumb);
    thumbs.delete(s.serial);
  }
  setState({
    groups: state.groups.filter((g) => g.id !== id),
    serials: state.serials.filter((s) => s.groupId !== id),
  });
}

/** コピーしたシリアルに印を付ける。 */
export function markCopied(serials: string[]) {
  const set = new Set(serials);
  setState({
    ...state,
    serials: state.serials.map((s) => (set.has(s.serial) ? { ...s, copied: true } : s)),
  });
}

/** すべて消す。 */
export function clearAll() {
  for (const url of thumbs.values()) URL.revokeObjectURL(url);
  thumbs.clear();
  setState({ groups: [], serials: [] });
}
