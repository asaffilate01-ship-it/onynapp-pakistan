export type PilotLocation = {
  id: string;
  label: string;
  city: "Lahore" | "Islamabad" | "Karachi";
  launchStatus: "pilot" | "coming_soon";
  aliases?: string[];
};

export const pilotLocations: PilotLocation[] = [
  {
    id: "gulberg-iii",
    label: "Gulberg III, Lahore",
    city: "Lahore",
    launchStatus: "pilot",
    aliases: ["Gulberg 3 Lahore"],
  },
  {
    id: "dha-phase-5",
    label: "DHA Phase 5, Lahore",
    city: "Lahore",
    launchStatus: "pilot",
    aliases: ["DHA 5 Lahore", "DHA Phase V Lahore"],
  },
  {
    id: "f7-islamabad",
    label: "F-7 Markaz, Islamabad",
    city: "Islamabad",
    launchStatus: "coming_soon",
  },
  {
    id: "clifton-karachi",
    label: "Clifton Block 5, Karachi",
    city: "Karachi",
    launchStatus: "coming_soon",
  },
];

export type ServiceabilityResult =
  | { status: "serviceable"; location: PilotLocation; message: string }
  | { status: "coming_soon"; city: string; message: string }
  | { status: "unknown"; message: string };

function normalise(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

export function checkPilotServiceability(query: string): ServiceabilityResult {
  const value = normalise(query);
  if (value.length < 3) {
    return {
      status: "unknown",
      message: "Enter an area and city, for example Gulberg III, Lahore.",
    };
  }

  const exactArea = pilotLocations.find((location) => {
    const patterns = [location.label, ...(location.aliases ?? [])];
    return patterns.some((pattern) => {
      const importantWords = normalise(pattern)
        .split(" ")
        .filter((word) => word.length > 2 || /^\d+$/.test(word) || /^[ivxlcdm]+$/.test(word));
      return importantWords.every((word) => value.split(" ").includes(word));
    });
  });

  if (exactArea?.launchStatus === "pilot") {
    return {
      status: "serviceable",
      location: exactArea,
      message: `${exactArea.label} is inside the controlled Lahore pilot area.`,
    };
  }
  if (exactArea) {
    return {
      status: "coming_soon",
      city: exactArea.city,
      message: `${exactArea.city} is not open yet. Join the launch waitlist instead of placing an order.`,
    };
  }

  const city = ["lahore", "islamabad", "karachi"].find((candidate) => value.includes(candidate));
  if (city) {
    const displayCity = city.charAt(0).toUpperCase() + city.slice(1);
    return {
      status: "coming_soon",
      city: displayCity,
      message:
        city === "lahore"
          ? "This Lahore address is outside the two controlled pilot zones for now."
          : `${displayCity} is coming soon; the current controlled pilot is in selected Lahore zones.`,
    };
  }

  return {
    status: "unknown",
    message: "We could not confirm this address. Add the area, city and a recognisable landmark.",
  };
}

export function isPilotLocationServiceable(label: string): boolean {
  return pilotLocations.some(
    (location) => location.label === label && location.launchStatus === "pilot",
  );
}
