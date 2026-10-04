import { describe, expect, it } from "vitest";
import { isSameArtist, isSameTitle, normalizeTitle, similarity } from "../../src/shared/scan.ts";

describe("isSameTitle", () => {
  it("1〜2文字の読み落としは同じ応募先とみなす", () => {
    expect(isSameTitle("乃木坂4642nd", "乃坂4642nd")).toBe(true);
    expect(isSameTitle("乃木坂4642nd", "木坂4642nd")).toBe(true);
  });

  it("重なった紙でタイトルの一部しか読めなくても、同じ応募先とみなす", () => {
    expect(isSameTitle("乃木坂4642nd", "42nd")).toBe(true);
  });

  it("数字だけが違うタイトルは別の応募先とみなす", () => {
    expect(isSameTitle("乃木坂4642nd", "乃木坂4640th")).toBe(false);
    expect(isSameTitle("乃木坂4641st", "乃木坂4642nd")).toBe(false);
    expect(isSameTitle("42nd", "乃木坂4640th")).toBe(false);
  });

  it("短すぎる部分一致では同じとみなさない", () => {
    expect(isSameTitle("2nd", "乃木坂4642nd")).toBe(false);
  });

  it("まったく違うタイトルは別の応募先とみなす", () => {
    expect(isSameTitle("是非に及ばず発売記念", "乃木坂4642nd")).toBe(false);
  });
});

describe("isSameArtist", () => {
  it("URLの1文字の読み違いは同じアーティストとみなす", () => {
    expect(isSameArtist("nogizaka46", "nogi-aka46")).toBe(true);
  });

  it("グループ名が似ていても別のアーティストを見分ける", () => {
    // タイトルだけでは「日向坂4617th」と「乃木坂4617th」が似ているため、アーティストで分ける
    expect(isSameArtist("hinatazaka46", "nogizaka46")).toBe(false);
    expect(isSameArtist("sakurazaka46", "hinatazaka46")).toBe(false);
  });

  it("どちらかが分からなければ同じとみなす", () => {
    expect(isSameArtist(undefined, "nogizaka46")).toBe(true);
  });
});

describe("normalizeTitle", () => {
  it("空白と記号を除く", () => {
    expect(normalizeTitle("「是非に 及ばず」発売記念")).toBe("是非に及ばず発売記念");
  });
});

describe("similarity", () => {
  it("同じ文字列は1、1文字違いは長さに応じて下がる", () => {
    expect(similarity("ABCD", "ABCD")).toBe(1);
    expect(similarity("ABCD", "ABCE")).toBe(0.75);
    expect(similarity("", "ABCD")).toBe(0);
  });
});
