import standardsFile from "@/data/qualifying-times.json";

export interface QualifyingWindow {
  from: string;
  until: string | null;
  summary: string;
}

const file = standardsFile as {
  county: { window: QualifyingWindow; shortLabel: string };
  regional: { window: QualifyingWindow; shortLabel: string };
};

export function countyWindow(): QualifyingWindow {
  return file.county.window;
}

export function regionalWindow(): QualifyingWindow {
  return file.regional.window;
}

export function parseMeetDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = 2000 + Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${match[2]}-${match[1]}`;
}

export function formatIsoDate(iso: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${months[month - 1]} ${year}`;
}

export function formatMeetDate(raw: string | null | undefined): string | null {
  const iso = parseMeetDate(raw);
  return iso ? formatIsoDate(iso) : raw ?? null;
}

export function formatAgeAt(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return value;
  return formatIsoDate(`${match[3]}-${match[2]}-${match[1]}`);
}

type Placement = "before" | "inside" | "after";

export function windowPlacement(iso: string, window: QualifyingWindow): Placement {
  if (iso < window.from) return "before";
  if (window.until && iso > window.until) return "after";
  return "inside";
}

export function qualifyingWindowLine(rawDate: string | null | undefined): string | null {
  const iso = parseMeetDate(rawDate ?? null);
  if (!iso) return null;
  const county = windowPlacement(iso, countyWindow());
  const regional = windowPlacement(iso, regionalWindow());
  if (county === "inside" && regional === "inside") {
    return "In the county and regional qualifying windows.";
  }
  return [placementText("county", county, countyWindow()), placementText("regional", regional, regionalWindow())].join(" ");
}

function placementText(name: string, placement: Placement, window: QualifyingWindow): string {
  if (placement === "inside") return `In the ${name} window.`;
  if (placement === "before") return `Before the ${name} window, which opens ${formatIsoDate(window.from)}.`;
  return `After the ${name} deadline of ${formatIsoDate(window.until ?? window.from)}.`;
}
