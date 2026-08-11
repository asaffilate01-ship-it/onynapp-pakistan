import { describe, expect, it } from "vitest";
import {
  checkPilotServiceability,
  isPilotLocationServiceable,
  pilotLocations,
} from "./serviceability";

describe("Pakistan pilot serviceability", () => {
  it("accepts Gulberg III in Lahore", () => {
    expect(checkPilotServiceability("House 4, Gulberg III, Lahore").status).toBe("serviceable");
    expect(checkPilotServiceability("Gulberg 3 Lahore").status).toBe("serviceable");
  });

  it("accepts DHA Phase 5 in Lahore", () => {
    expect(checkPilotServiceability("DHA phase 5 Lahore near LUMS").status).toBe("serviceable");
    expect(checkPilotServiceability("DHA 5 Lahore").status).toBe("serviceable");
    expect(checkPilotServiceability("DHA Phase 6 Lahore").status).toBe("coming_soon");
  });

  it("does not present Islamabad as live", () => {
    expect(checkPilotServiceability("F-7 Markaz Islamabad").status).toBe("coming_soon");
  });

  it("does not present Karachi as live", () => {
    expect(checkPilotServiceability("Clifton Block 5 Karachi").status).toBe("coming_soon");
  });

  it("does not silently accept another Lahore area", () => {
    expect(checkPilotServiceability("Model Town Lahore").status).toBe("coming_soon");
  });

  it("requires enough address detail", () => {
    expect(checkPilotServiceability("PK").status).toBe("unknown");
  });

  it("keeps exactly two launch locations", () => {
    expect(pilotLocations.filter((location) => location.launchStatus === "pilot")).toHaveLength(2);
  });

  it("reports serviceability by selected label", () => {
    expect(isPilotLocationServiceable("Gulberg III, Lahore")).toBe(true);
    expect(isPilotLocationServiceable("F-7 Markaz, Islamabad")).toBe(false);
  });
});
