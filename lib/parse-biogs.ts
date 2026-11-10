import { parse, type HTMLElement } from "node-html-parser";
import { parseEventLabel, type EventKey } from "./events";
import { parseSwimTime } from "./time";
import type { BestTimes, Gender, SwimmerProfile } from "./types";

export function parseBiogs(html: string): SwimmerProfile {
  const root = parse(html);
  const rows = root.querySelectorAll("tr").map((row) =>
    row.querySelectorAll("td").map((cell) => clean(cell)),
  );

  let name = "";
  let knownAs: string | null = null;
  let yearOfBirth: number | null = null;
  let gender: Gender | null = null;
  let membershipNumber: string | null = null;
  let club: string | null = null;

  for (const cells of rows) {
    if (cells.length < 2) continue;
    const label = cells[0].toLowerCase();
    const value = cells[1];
    if (label === "name") name = value;
    if (label === "known as") knownAs = value;
    if (label === "year of birth") yearOfBirth = Number(value) || null;
    if (label === "eligibility category") gender = genderFrom(value);
    if (label === "member number") membershipNumber = value.replace(/\s+/g, "");
    if (label === "ranked club") club = value;
  }

  const header = rows.find((cells) => cells.some((cell) => /short course pb/i.test(cell)));
  const bests: BestTimes[] = [];
  let seasonLabel: string | null = null;
  let parseError: string | null = null;

  if (!header) {
    parseError = "The biography page did not include a best-times table.";
  } else {
    const shortPb = indexOf(header, /short course pb/i);
    const longPb = indexOf(header, /long course pb/i);
    const shortSeason = indexOf(header, /^\d{4} short course$/i);
    const longSeason = indexOf(header, /^\d{4} long course$/i);
    const seasonMatch = header.join(" ").match(/\b(20\d{2})\b/);
    seasonLabel = seasonMatch?.[1] ?? null;

    for (const cells of rows) {
      const event = parseEventLabel(cells[0] ?? "");
      if (!event || cells.length < 4) continue;
      bests.push({
        event,
        shortCoursePb: readTime(cells, shortPb),
        longCoursePb: readTime(cells, longPb),
        shortCourseSeason: readTime(cells, shortSeason),
        longCourseSeason: readTime(cells, longSeason),
      });
    }
    if (bests.length === 0) parseError = "No event rows were found in the best-times table.";
  }

  if (!name) parseError = parseError ?? "The biography page did not include a swimmer name.";

  return {
    name,
    knownAs,
    yearOfBirth,
    gender,
    membershipNumber,
    club,
    seasonLabel,
    bests,
    parseError,
  };
}

export function bestFor(bests: BestTimes[], event: EventKey): BestTimes | undefined {
  return bests.find(
    (item) => item.event.distance === event.distance && item.event.stroke === event.stroke,
  );
}

function clean(cell: HTMLElement): string {
  return cell.text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function indexOf(cells: string[], pattern: RegExp): number {
  return cells.findIndex((cell) => pattern.test(cell));
}

function readTime(cells: string[], index: number) {
  if (index < 0) return null;
  return parseSwimTime(cells[index] ?? "");
}

function genderFrom(value: string): Gender | null {
  const text = value.toLowerCase();
  if (text.includes("female")) return "female";
  if (text.includes("male") || text.includes("open")) return "male";
  return null;
}
