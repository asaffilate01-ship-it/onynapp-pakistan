export type DishbeeOneSurface = "epos" | "kds";

export type DishbeeOneConnection =
  { configured: false; reason: string } | { configured: true; baseUrl: string };

export function parseDishbeeOneUrl(raw: string | undefined): DishbeeOneConnection {
  if (!raw?.trim()) {
    return {
      configured: false,
      reason: "Set VITE_DISHBEE_ONE_URL after the Dishbee One tenant and staging access are ready.",
    };
  }
  try {
    const url = new URL(raw.trim());
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !local) {
      return { configured: false, reason: "Dishbee One must use HTTPS outside local development." };
    }
    url.hash = "";
    url.search = "";
    return { configured: true, baseUrl: url.toString().replace(/\/$/, "") };
  } catch {
    return { configured: false, reason: "VITE_DISHBEE_ONE_URL is not a valid URL." };
  }
}

export function getDishbeeOneConnection() {
  return parseDishbeeOneUrl(import.meta.env.VITE_DISHBEE_ONE_URL);
}

export function dishbeeOneSurfaceUrl(connection: DishbeeOneConnection, surface: DishbeeOneSurface) {
  if (!connection.configured) return null;
  const target = new URL(surface === "epos" ? "/epos" : "/kds", connection.baseUrl);
  target.searchParams.set("source", "dishbee-plus");
  return target.toString();
}
