import { describe, expect, it } from "vitest";
import { cleanInput } from "@/lib/input-kinds";

describe("cleanInput: each box keeps only what belongs in it", () => {
  it("money takes digits and two decimals", () => {
    expect(cleanInput("money", "g5g0u.123.4")).toBe("50.12");
    expect(cleanInput("money", "abcd")).toBe("");
    expect(cleanInput("money", "12345678901234")).toBe("1234567890");
  });
  it("percent stops at 100", () => {
    expect(cleanInput("percent", "150")).toBe("100");
    expect(cleanInput("percent", "12.567")).toBe("12.56");
  });
  it("integer takes digits only", () => {
    expect(cleanInput("integer", "4a2-")).toBe("42");
  });
  it("phone keeps digits and phone punctuation", () => {
    expect(cleanInput("phone", "+94 (77) 123-4567 ext")).toBe("+94 (77) 123-4567 ");
    expect(cleanInput("phone", "abc")).toBe("");
  });
  it("email drops spaces and impossible characters", () => {
    expect(cleanInput("email", "ni mal@exa mple.com!")).toBe("nimal@example.com");
  });
  it("person names have no digits or symbols but keep any language", () => {
    expect(cleanInput("personName", "Nimal 7 Perera$")).toBe("Nimal Perera");
    expect(cleanInput("personName", "O'Neil-Silva Jr.")).toBe("O'Neil-Silva Jr.");
    expect(cleanInput("personName", "நிமல்")).toBe("நிமல்");
  });
  it("places and postal codes", () => {
    expect(cleanInput("place", "Colombo 07")).toBe("Colombo ");
    expect(cleanInput("postal", "00700 ab!")).toBe("00700 AB");
  });
  it("addresses keep digits and usual punctuation", () => {
    expect(cleanInput("address", "No. 12/3, Galle Rd (2nd floor) $@")).toBe("No. 12/3, Galle Rd (2nd floor) ");
  });
  it("titles drop only markup-like characters", () => {
    expect(cleanInput("title", "Dining Table <180> {oak}")).toBe("Dining Table 180 oak");
    expect(cleanInput("title", "Chair & Stool (2 pcs)")).toBe("Chair & Stool (2 pcs)");
  });
  it("urls lose spaces", () => {
    expect(cleanInput("url", "https://fb.com/ my page")).toBe("https://fb.com/mypage");
  });
  it("currency is three capital letters", () => {
    expect(cleanInput("currency", "lk1r9")).toBe("LKR");
  });
  it("order numbers are digits", () => {
    expect(cleanInput("orderNumber", "482-719 366x")).toBe("482-719 366");
  });
  it("dimensions and budgets", () => {
    expect(cleanInput("dimensions", "180 × 90 × 75 cm @")).toBe("180 × 90 × 75 cm ");
    expect(cleanInput("budget", "LKR 200,000 - 300,000 $")).toBe("LKR 200,000 - 300,000 ");
  });
});

describe("cleanInput: country code", () => {
  it("is up to three digits, as the server expects", () => {
    expect(cleanInput("countryCode", "+9a4")).toBe("+94");
    expect(cleanInput("countryCode", "94")).toBe("+94");
    expect(cleanInput("countryCode", "12345")).toBe("+123");
    expect(cleanInput("countryCode", "abc")).toBe("");
  });
});
