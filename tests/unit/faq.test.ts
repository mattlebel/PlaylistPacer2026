import { describe, expect, it } from "vitest";
import { faq } from "@/lib/faq";

describe("FAQ", () => {
  const base = { runner: "Matt", paceSec: 660, perMile: 3, maxPerPerson: 15, bib: "13302" };

  it("answers with this runner's pace, limits and bib", () => {
    const all = faq(base);
    const timing = all.find((f) => f.q.startsWith("Will my song play exactly"))!;
    expect(timing.a).toContain("11:00 a mile");
    expect(timing.a).toContain("roughly 11 minutes, or about 3 songs");
    expect(all.find((f) => f.q === "How many songs can I add?")!.a).toMatch(/^Up to 15/);
    expect(all.find((f) => f.q.startsWith("How can I follow"))!.a).toContain("bib 13302");
  });

  it("drops the questions about adding once adding has closed", () => {
    const open = faq(base).map((f) => f.q);
    const closed = faq({ ...base, open: false }).map((f) => f.q);
    expect(open).toContain("When does adding close?");
    expect(closed).not.toContain("When does adding close?");
    expect(closed).not.toContain("How many songs can I add?");
    expect(closed).toContain("Does Matt get to skip songs?");
  });
});
