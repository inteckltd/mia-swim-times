export type Stroke = "freestyle" | "backstroke" | "breaststroke" | "butterfly" | "im";

export interface EventKey {
  distance: number;
  stroke: Stroke;
}

const DISTANCES = new Set([50, 100, 200, 400, 800, 1500]);

const STROKE_LABEL: Record<Stroke, string> = {
  freestyle: "Freestyle",
  backstroke: "Backstroke",
  breaststroke: "Breaststroke",
  butterfly: "Butterfly",
  im: "IM",
};

export const EVENT_ORDER = [
  "50-freestyle",
  "100-freestyle",
  "200-freestyle",
  "400-freestyle",
  "800-freestyle",
  "1500-freestyle",
  "50-backstroke",
  "100-backstroke",
  "200-backstroke",
  "50-breaststroke",
  "100-breaststroke",
  "200-breaststroke",
  "50-butterfly",
  "100-butterfly",
  "200-butterfly",
  "100-im",
  "200-im",
  "400-im",
];

export function eventId(event: EventKey): string {
  return `${event.distance}-${event.stroke}`;
}

export function eventLabel(event: EventKey): string {
  return `${event.distance}m ${STROKE_LABEL[event.stroke]}`;
}

export function parseEventLabel(label: string): EventKey | null {
  const match = label.match(/(\d+)\s*m\s+([A-Za-z.]+(?:\s+[A-Za-z.]+)?)/);
  if (!match) return null;
  const distance = Number(match[1]);
  if (!DISTANCES.has(distance)) return null;
  const words = match[2].toLowerCase().replace(/\./g, "");
  const stroke = strokeFrom(words) ?? strokeFrom(words.split(/\s+/)[0] ?? "");
  if (!stroke) return null;
  return { distance, stroke };
}

function strokeFrom(word: string): Stroke | null {
  if (/individual\s+medley|ind\s*medley|^im$|^medley$/.test(word)) return "im";
  if (/^free|^fr$/.test(word)) return "freestyle";
  if (/^back|^ba$/.test(word)) return "backstroke";
  if (/^breast|^br$/.test(word)) return "breaststroke";
  if (/^fly|^butt|^fl$/.test(word)) return "butterfly";
  return null;
}

export function namesMatch(left: string, right: string): boolean {
  return nameKey(left) === nameKey(right) && nameKey(left).length > 0;
}

function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

export function clubMatches(club: string, fragment: string): boolean {
  const needle = fragment.trim().toLowerCase();
  if (!needle) return false;
  return club.toLowerCase().includes(needle);
}
