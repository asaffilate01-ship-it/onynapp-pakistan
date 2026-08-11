import { describe, expect, it } from "vitest";
import { mapVendorBackendMenuItem, mapVendorBackendOrder } from "./vendor-workspace";

describe("vendor workspace backend mapping", () => {
  it("maps a protected order payload to the UI model", () => {
    const order = mapVendorBackendOrder(
      {
        id: "order-id",
        reference: "ONY-2001",
        status: "preparing",
        fulfilment: "delivery",
        payment_method: "cod",
        total_paisa: "237000",
        placed_at: "2026-08-11T10:00:00.000Z",
        address_text: "House 24, Street 7",
        landmark: "Near Main Market",
        customer_note: "Less spicy",
        delivery_note: "Call at gate",
        order_lines: [
          { id: "line-1", name: "Chicken Karahi", quantity: 1, options: ["Medium spice"] },
          { id: "line-2", name: "Mint Lemonade", quantity: 2 },
        ],
      },
      30,
    );

    expect(order.reference).toBe("ONY-2001");
    expect(order.totalPaisa).toBe(237000);
    expect(order.address).toContain("Near Main Market");
    expect(order.note).toContain("Call at gate");
    expect(order.lines[1].station).toBe("Drinks");
    expect(order.lines[0].note).toBe("Medium spice");
    expect(order.promisedMinutes).toBe(30);
  });

  it("maps a completed database status", () => {
    expect(
      mapVendorBackendOrder(
        { id: "1", status: "collected", fulfilment: "collection", order_lines: [] },
        25,
      ).status,
    ).toBe("completed");
  });

  it("rejects an unsupported status", () => {
    expect(() =>
      mapVendorBackendOrder({ id: "1", status: "refund_pending", order_lines: [] }, 25),
    ).toThrow("Unsupported vendor order status");
  });

  it("maps menu prices from paisa to rupees", () => {
    expect(
      mapVendorBackendMenuItem({
        id: "menu-1",
        name: "Malai Boti",
        price_paisa: 64900,
        available: true,
        menu_option_groups: [
          {
            id: "group-1",
            name: "Size",
            required: true,
            min_selections: 1,
            max_selections: 1,
            menu_options: [
              {
                id: "option-1",
                name: "Large",
                price_delta_paisa: 15000,
                available: true,
              },
            ],
          },
        ],
      }),
    ).toEqual({
      id: "menu-1",
      name: "Malai Boti",
      category: "Menu",
      price: 649,
      available: true,
      optionGroups: [
        {
          id: "group-1",
          name: "Size",
          required: true,
          minSelections: 1,
          maxSelections: 1,
          options: [{ id: "option-1", name: "Large", priceDelta: 150, available: true }],
        },
      ],
    });
  });
});
