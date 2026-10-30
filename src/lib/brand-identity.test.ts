import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");

function purpleHexValues(css: string) {
  const values = css.match(/#[0-9a-f]{6}\b/gi) ?? [];

  return values.filter((value) => {
    const red = Number.parseInt(value.slice(1, 3), 16) / 255;
    const green = Number.parseInt(value.slice(3, 5), 16) / 255;
    const blue = Number.parseInt(value.slice(5, 7), 16) / 255;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const delta = maximum - minimum;
    let hue = 0;

    if (delta > 0) {
      if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
      if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
      if (maximum === blue) hue = 60 * ((red - green) / delta + 4);
    }

    if (hue < 0) hue += 360;
    const lightness = (maximum + minimum) / 2;
    const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;

    return hue >= 240 && hue <= 345 && saturation > 0.08;
  });
}

describe("Dishbee+ brand identity", () => {
  it("uses the approved black/navy and yellow palette without Onyn purple", () => {
    const styles = readFileSync(resolve(projectRoot, "src/styles.css"), "utf8");

    expect(styles).toContain("--dishbee-navy: #0b2340");
    expect(styles).toContain("--dishbee-amber: #f4b400");
    expect(purpleHexValues(styles)).toEqual([]);
  });

  it("publishes the Dishbee icon and PWA theme", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(projectRoot, "public/manifest.webmanifest"), "utf8"),
    ) as { theme_color: string; icons: Array<{ src: string }> };

    expect(manifest.theme_color).toBe("#0b1728");
    expect(manifest.icons[0]?.src).toBe("/dishbee-plus-mark.svg");
    expect(existsSync(resolve(projectRoot, "public/dishbee-plus-mark.svg"))).toBe(true);
    expect(existsSync(resolve(projectRoot, "public/onyn-mark.svg"))).toBe(false);
  });

  it("uses Dishbee+ in outbound notification fallbacks", () => {
    const notificationWorker = readFileSync(
      resolve(projectRoot, "supabase/functions/process-notifications/index.ts"),
      "utf8",
    );

    expect(notificationWorker).toContain('"Dishbee+ Pakistan"');
    expect(notificationWorker).not.toContain('"Onyn Pakistan"');
  });
});
