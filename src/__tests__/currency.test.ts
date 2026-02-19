import { describe, it, expect } from "vitest";
import { formatPaiseToCurrency, rupeesToPaise, paiseToRupees, toPaise } from "@/lib/currency";

describe("currency utilities", () => {
  it("converts rupees string to paise", () => {
    expect(rupeesToPaise("100.50")).toBe(10050);
    expect(rupeesToPaise("0")).toBe(0);
    expect(rupeesToPaise("1")).toBe(100);
    expect(rupeesToPaise("99.99")).toBe(9999);
  });

  it("returns 0 for invalid rupee input", () => {
    expect(rupeesToPaise("")).toBe(0);
    expect(rupeesToPaise("abc")).toBe(0);
    expect(rupeesToPaise("-5")).toBe(0);
  });

  it("formats paise to INR currency string", () => {
    expect(formatPaiseToCurrency(10050)).toBe("₹100.50");
    expect(formatPaiseToCurrency(0)).toBe("₹0.00");
    expect(formatPaiseToCurrency(100)).toBe("₹1.00");
  });

  it("converts paise to rupees number", () => {
    expect(paiseToRupees(10050)).toBe(100.50);
    expect(paiseToRupees(0)).toBe(0);
    expect(paiseToRupees(100)).toBe(1);
  });

  it("creates Paise from number with rounding", () => {
    expect(toPaise(100.4)).toBe(100);
    expect(toPaise(100.5)).toBe(101);
    expect(toPaise(100)).toBe(100);
  });
});
