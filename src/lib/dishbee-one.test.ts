import { describe, expect, it } from "vitest";
import { dishbeeOneSurfaceUrl, parseDishbeeOneUrl } from "./dishbee-one";

describe("Dishbee One connection boundary", () => {
  it("requires HTTPS outside local development", () => {
    expect(parseDishbeeOneUrl("http://dishbee.example.com").configured).toBe(false);
    expect(parseDishbeeOneUrl("http://localhost:3000").configured).toBe(true);
  });

  it("builds credential-free EPOS and KDS links", () => {
    const connection = parseDishbeeOneUrl("https://one.dishbee.example/base?token=remove-me");
    const target = dishbeeOneSurfaceUrl(connection, "epos");
    expect(target).toBe("https://one.dishbee.example/epos?source=dishbee-plus");
    expect(target).not.toContain("token");
  });
});
