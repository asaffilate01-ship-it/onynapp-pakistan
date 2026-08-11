import { normalizePakistanPhone } from "./pilot";

export type PartnerApplicationType = "restaurant" | "home_chef" | "sales_agent" | "supplier";
export type SupportCategory =
  "order_issue" | "delivery_issue" | "account_issue" | "safety_issue" | "payment_issue" | "other";

export type PartnerApplicationInput = {
  applicationType: PartnerApplicationType;
  tradingName: string;
  city: "Lahore" | "Karachi" | "Islamabad" | "Rawalpindi";
  area: string;
  contactName: string;
  phone: string;
  email?: string;
  details?: string;
};

export function validatePartnerApplication(input: PartnerApplicationInput): string | null {
  if (input.tradingName.trim().length < 2) return "Enter the business or applicant name.";
  if (input.area.trim().length < 2) return "Enter the operating area.";
  if (input.contactName.trim().length < 2) return "Enter the main contact name.";
  if (!normalizePakistanPhone(input.phone)) return "Enter a valid Pakistan mobile number.";
  if (input.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return "Enter a valid email address or leave it blank.";
  }
  if ((input.details?.trim().length ?? 0) > 1000)
    return "Keep additional details under 1,000 characters.";
  return null;
}

export function parseMenuCsv(csv: string): {
  rows: Array<{
    name: string;
    category: string;
    description: string;
    price_paisa: number;
    available: boolean;
  }>;
  error: string | null;
} {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { rows: [], error: "Paste at least one menu row." };

  const first = lines[0].toLowerCase();
  const dataLines = first.startsWith("name,category,price") ? lines.slice(1) : lines;
  if (dataLines.length > 200) return { rows: [], error: "Import a maximum of 200 items at once." };

  const rows = [];
  for (let index = 0; index < dataLines.length; index += 1) {
    const columns = dataLines[index].split(",").map((value) => value.trim());
    const [name, category, price, description = "", availability = "true"] = columns;
    const priceRupees = Number(price);
    if (!name || !category || !Number.isFinite(priceRupees) || priceRupees < 0) {
      return {
        rows: [],
        error: `Check menu row ${index + 1}: name, category and price are required.`,
      };
    }
    rows.push({
      name,
      category,
      description,
      price_paisa: Math.round(priceRupees * 100),
      available: !["false", "no", "sold out", "0"].includes(availability.toLowerCase()),
    });
  }
  return { rows, error: null };
}

export function nextRiderActions(status: string): Array<{ next: string; label: string }> {
  if (status === "offered") return [{ next: "accepted", label: "Accept delivery" }];
  if (status === "accepted") return [{ next: "at_pickup", label: "Arrived at restaurant" }];
  if (status === "at_pickup") return [{ next: "picked_up", label: "Confirm pickup" }];
  if (status === "picked_up") {
    return [
      { next: "delivered", label: "Confirm delivery" },
      { next: "failed", label: "Report delivery problem" },
    ];
  }
  return [];
}
