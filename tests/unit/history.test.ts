import { describe, expect, it } from "vitest";
import { MAX_MILESTONES, parseHistory } from "@/lib/history";

describe("parseHistory", () => {
  it("reads year, heading and story from each block", () => {
    const r = parseHistory("2009\nThe first bench\nWe started with one bench\nand two hand tools.\n\n2015\nThe showroom");
    expect(r).toEqual([
      { when: "2009", title: "The first bench", body: "We started with one bench and two hand tools." },
      { when: "2015", title: "The showroom", body: null },
    ]);
  });
  it("copes with Windows line endings and stray blank lines", () => {
    expect(parseHistory("\r\n\r\n2001\r\nStart\r\n\r\n\r\n\r\n2002\r\nNext\r\nMore")).toHaveLength(2);
  });
  it("skips blocks without a heading and returns nothing for no text", () => {
    expect(parseHistory("2009")).toEqual([]);
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory("")).toEqual([]);
  });
  it("caps the number of milestones", () => {
    const many = Array.from({ length: 30 }, (_, i) => `${2000 + i}\nTitle ${i}`).join("\n\n");
    expect(parseHistory(many)).toHaveLength(MAX_MILESTONES);
  });
});
