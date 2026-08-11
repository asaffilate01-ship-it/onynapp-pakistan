import { describe, expect, it } from "vitest";
import { calculateTrustedTotals, normalizePakistanPhone } from "./pilot";

describe("normalizePakistanPhone", () => {
  it.each([
    ["0300 1234567", "+923001234567"],
    ["+92 300 123 4567", "+923001234567"],
    ["0092-300-1234567", "+923001234567"],
  ])("normalises %s", (input, expected) => {
    expect(normalizePakistanPhone(input)).toBe(expected);
  });

  it.each(["", "0211234567", "300123", "+44 7700 900123"])("rejects %s", (input) => {
    expect(normalizePakistanPhone(input)).toBeNull();
  });
});

describe("calculateTrustedTotals", () => {
  const catalog = [
    { id: "karahi", pricePaisa: 89_900, available: true },
    { id: "naan", pricePaisa: 6_000, available: true },
    { id: "sold-out", pricePaisa: 10_000, available: false },
  ];

  it("calculates delivery from trusted catalog prices", () => {
    expect(
      calculateTrustedTotals({
        requested: [
          { menuItemId: "karahi", quantity: 1 },
          { menuItemId: "naan", quantity: 2 },
        ],
        catalog,
        fulfilment: "delivery",
        deliveryFeePaisa: 8_900,
        serviceFeePaisa: 2_900,
      }),
    ).toEqual({
      subtotalPaisa: 101_900,
      deliveryFeePaisa: 8_900,
      serviceFeePaisa: 2_900,
      totalPaisa: 113_700,
    });
  });

  it("removes delivery fees for collection", () => {
    expect(
      calculateTrustedTotals({
        requested: [{ menuItemId: "karahi", quantity: 1 }],
        catalog,
        fulfilment: "collection",
        deliveryFeePaisa: 8_900,
        serviceFeePaisa: 2_900,
      }).deliveryFeePaisa,
    ).toBe(0);
  });

  it.each([
    [[{ menuItemId: "missing", quantity: 1 }], "unavailable"],
    [[{ menuItemId: "sold-out", quantity: 1 }], "unavailable"],
    [[{ menuItemId: "karahi", quantity: 0 }], "Quantity"],
    [
      [
        { menuItemId: "karahi", quantity: 1 },
        { menuItemId: "karahi", quantity: 1 },
      ],
      "Duplicate",
    ],
  ])("rejects untrusted request %o", (requested, message) => {
    expect(() =>
      calculateTrustedTotals({
        requested,
        catalog,
        fulfilment: "delivery",
        deliveryFeePaisa: 8_900,
        serviceFeePaisa: 2_900,
      }),
    ).toThrow(message);
  });
});
