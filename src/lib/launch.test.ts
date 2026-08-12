import { describe, expect, it } from "vitest";
import {
  codDifferencePaisa,
  nextRiderActions,
  parseMenuCsv,
  requiredRiderEvidence,
  validatePartnerApplication,
} from "./launch";

describe("controlled launch helpers", () => {
  it("validates a Pakistan partner application", () => {
    expect(
      validatePartnerApplication({
        applicationType: "restaurant",
        tradingName: "Lahore Kitchen",
        city: "Lahore",
        area: "Gulberg III",
        contactName: "Ayesha Khan",
        phone: "03001234567",
        email: "owner@example.com",
      }),
    ).toBeNull();
    expect(
      validatePartnerApplication({
        applicationType: "restaurant",
        tradingName: "L",
        city: "Lahore",
        area: "",
        contactName: "A",
        phone: "123",
      }),
    ).toBeTruthy();
  });

  it("parses a reviewed menu CSV into server units", () => {
    expect(
      parseMenuCsv("name,category,price,description,available\nKarahi,Mains,899,Half,true"),
    ).toEqual({
      rows: [
        {
          name: "Karahi",
          category: "Mains",
          description: "Half",
          price_paisa: 89900,
          available: true,
        },
      ],
      error: null,
    });
    expect(parseMenuCsv("Broken,Mains,nope").error).toContain("row 1");
  });

  it("only exposes valid rider state transitions", () => {
    expect(nextRiderActions("offered")).toEqual([{ next: "accepted", label: "Accept delivery" }]);
    expect(nextRiderActions("delivered")).toEqual([]);
  });

  it("requires identity evidence and a licence for motorbike riders", () => {
    expect(requiredRiderEvidence("bicycle").map((item) => item.kind)).toEqual([
      "cnic_front",
      "cnic_back",
    ]);
    expect(requiredRiderEvidence("motorbike").map((item) => item.kind)).toContain("licence_front");
  });

  it("calculates COD discrepancies in paisa without floating drift", () => {
    expect(codDifferencePaisa(89900, "899")).toBe(0);
    expect(codDifferencePaisa(89900, "900")).toBe(100);
    expect(codDifferencePaisa(89900, "not cash")).toBeNull();
  });
});
