import { describe, expect, it } from "vitest";
import {
  canRequestCancellation,
  configuredItemPrice,
  customerOrderProgress,
  mapCustomerOrders,
  mapMarketplaceCatalog,
  optionSelectionError,
  optionSelectionSignature,
} from "./customer-workspace";

describe("customer marketplace mapping", () => {
  it("maps server prices and availability without inventing ratings", () => {
    const result = mapMarketplaceCatalog(
      [
        {
          id: "branch-1",
          name: "Pilot Kitchen",
          city: "Lahore",
          address_text: "Gulberg III",
          delivery_fee_paisa: 14900,
          service_fee_paisa: 2500,
          minimum_order_paisa: 50000,
          accepts_delivery: true,
          accepts_collection: false,
          accepting_orders: true,
          default_prep_minutes: 25,
          busy_mode: false,
          schedule_configured: true,
          is_open: true,
        },
      ],
      [{ id: "cat-1", branch_id: "branch-1", name: "Pakistani" }],
      [
        {
          id: "item-1",
          branch_id: "branch-1",
          category_id: "cat-1",
          name: "Chicken Karahi",
          description: null,
          price_paisa: 129900,
          available: false,
        },
      ],
      [
        {
          id: "group-1",
          menu_item_id: "item-1",
          name: "Choose a size",
          required: true,
          min_selections: 1,
          max_selections: 1,
        },
      ],
      [
        {
          id: "option-1",
          group_id: "group-1",
          name: "Regular",
          price_delta_paisa: 0,
          available: true,
        },
        {
          id: "option-2",
          group_id: "group-1",
          name: "Large",
          price_delta_paisa: 30000,
          available: true,
        },
      ],
    );

    expect(result.restaurants[0]).toMatchObject({
      rating: 0,
      reviews: "New",
      delivery: 149,
      serviceFee: 25,
      min: 500,
      acceptingOrders: true,
    });
    expect(result.menu[0]).toMatchObject({
      price: 1299,
      available: false,
      category: "Pakistani",
    });
    expect(optionSelectionError(result.menu[0], [])).toContain("Choose at least 1");
    expect(optionSelectionError(result.menu[0], ["option-2"])).toBeNull();
    expect(configuredItemPrice(result.menu[0], ["option-2"])).toBe(1599);
    expect(optionSelectionSignature("item-1", ["option-2", "option-1"])).toBe(
      "item-1:option-1,option-2",
    );
  });
});

describe("customer order mapping", () => {
  it("maps protected order snapshots and progress", () => {
    const orders = mapCustomerOrders([
      {
        id: "order-1",
        reference: "ONYN-PK-1001",
        branch_id: "branch-1",
        branch_name: "Pilot Kitchen",
        status: "preparing",
        fulfilment: "delivery",
        payment_method: "cod",
        total_paisa: 157300,
        customer_note: null,
        placed_at: "2026-08-11T10:00:00Z",
        order_lines: [
          {
            id: "line-1",
            name: "Chicken Karahi",
            unit_price_paisa: 129900,
            quantity: 1,
            line_total_paisa: 129900,
            options: [{ group_name: "Spice", option_name: "Medium", price_delta_paisa: 0 }],
          },
        ],
        order_events: [{ status: "preparing", note: null, created_at: "2026-08-11T10:05:00Z" }],
        open_support_case_id: null,
      },
    ]);

    expect(orders[0]).toMatchObject({ total: 1573, status: "preparing" });
    expect(orders[0].lines[0].options[0].optionName).toBe("Medium");
    expect(customerOrderProgress("preparing")).toBe(58);
    expect(canRequestCancellation("preparing")).toBe(true);
    expect(canRequestCancellation("delivered")).toBe(false);
  });
});
