import { describe, expect, it } from "vitest";
import type { TextLine, Vec } from "../../src/ocr/core.ts";
import { extractSerials, findArtist, isSerial } from "../../src/ocr/parse.ts";

/** 写真の中の1行。紙を回した写真も表せるよう、読む向き `u` を指定できる。 */
function line(text: string, center: Vec, h: number, u: Vec = [1, 0]): TextLine {
  const v: Vec = [-u[1], u[0]];
  const w = text.length * h * 0.6;
  const p0: Vec = [center[0] - (u[0] * w + v[0] * h) / 2, center[1] - (u[1] * w + v[1] * h) / 2];
  return { text, conf: 0.99, minCharConf: 0.98, p0, u, v, w, h, center };
}

/** 試作の紙と同じ並び（タイトル3行・説明文・URL・シリアル）の1枚。`y` は紙の上端。 */
function paper(x: number, y: number, title: string, serial: string): TextLine[] {
  return [
    line(title, [x, y + 40], 40),
    line("「是非に及ばず」発売記念", [x, y + 85], 40),
    line("スペシャル抽選応募シリアルナンバー", [x, y + 130], 40),
    line("この度は、ご購入いただき誠にありがとうございます。", [x, y + 190], 22),
    line("本企画の詳細、応募及び抽選期間は、下記特設応募サイトもしくは", [x, y + 250], 22),
    line("https://ticket.fortunemeets.app/nogizaka46/", [x, y + 300], 30),
    line(serial, [x - 60, y + 380], 40),
    line("※裏面の注意事項もご確認ください", [x, y + 440], 20),
  ];
}

describe("isSerial", () => {
  it("英大文字と数字の10〜20文字をシリアルとみなす", () => {
    expect(isSerial("AB12CD34EF56GHX")).toBe(true);
    expect(isSerial("WW44 RDTQ ELB45CM")).toBe(true);
    expect(isSerial("SRCL13790")).toBe(false);
    expect(isSerial("TYPE-A(SRCL13790~1)")).toBe(false);
  });
});

describe("findArtist", () => {
  it("末尾の「/」まで読めたURLからアーティストを取り出す", () => {
    expect(findArtist("https://ticket.fortunemeets.app/nogizaka46/")).toBe("nogizaka46");
    expect(findArtist("https://ticket.fortunemusic.app/hinatazaka46/")).toBe("hinatazaka46");
  });

  it("途中で切れたURLは使わない", () => {
    expect(findArtist("https://ticket.fortunemeets.app/nogi")).toBeUndefined();
  });
});

describe("extractSerials", () => {
  it("シリアルごとに同じ紙のタイトルとアーティストを結び付ける", () => {
    const lines = [
      ...paper(500, 0, "乃木坂4642nd", "AAAAAAAAAA1111"),
      ...paper(1300, 0, "乃木坂4640th", "BBBBBBBBBB2222"),
    ];
    const found = extractSerials(lines);
    expect(found.map((f) => [f.serial, f.event.title, f.event.artist, f.eventSource])).toEqual([
      ["AAAAAAAAAA1111", "乃木坂4642nd", "nogizaka46", "paper"],
      ["BBBBBBBBBB2222", "乃木坂4640th", "nogizaka46", "paper"],
    ]);
  });

  it("逆さまの紙でも、その紙のタイトルを結び付ける", () => {
    // 180°回した紙: 読む向きが左向きで、紙の「上」は写真の下側になる
    const lines = paper(0, 0, "乃木坂4642nd", "CCCCCCCCCC3333").map((l) =>
      line(l.text, [1000 - l.center[0], 1000 - l.center[1]], l.h, [-1, 0]),
    );
    expect(extractSerials(lines)[0]?.event.title).toBe("乃木坂4642nd");
  });

  it("上に重なった別の紙の注意書きをタイトルとみなさない", () => {
    const lines = [
      ...paper(500, 0, "乃木坂4642nd", "DDDDDDDDDD4444"),
      ...paper(500, 470, "乃木坂4642nd", "EEEEEEEEEE5555"),
    ];
    const found = extractSerials(lines);
    expect(found.map((f) => f.event.title)).toEqual(["乃木坂4642nd", "乃木坂4642nd"]);
  });

  it("タイトルが隠れていても、写真の中の応募先が1種類ならそれとみなす", () => {
    const lines = [
      ...paper(500, 0, "乃木坂4642nd", "FFFFFFFFFF6666"),
      line("GGGGGGGGGG7777", [1500, 900], 40),
    ];
    const hidden = extractSerials(lines).find((f) => f.serial === "GGGGGGGGGG7777");
    expect(hidden?.event.title).toBe("乃木坂4642nd");
    expect(hidden?.eventSource).toBe("photo");
  });

  it("タイトルが隠れていて、写真の中の応募先が2種類以上なら決めない", () => {
    const lines = [
      ...paper(500, 0, "乃木坂4642nd", "HHHHHHHHHH8888"),
      ...paper(1300, 0, "乃木坂4640th", "IIIIIIIIII9999"),
      line("JJJJJJJJJJ0000", [900, 1500], 40),
    ];
    const hidden = extractSerials(lines).find((f) => f.serial === "JJJJJJJJJJ0000");
    expect(hidden?.event.title).toBeUndefined();
    expect(hidden?.eventSource).toBe("none");
  });
});
