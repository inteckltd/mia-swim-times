import type { Course } from "./types";

export const STROKE_CODE: Record<string, string> = {
  "50-freestyle": "1",
  "100-freestyle": "2",
  "200-freestyle": "3",
  "400-freestyle": "4",
  "800-freestyle": "5",
  "1500-freestyle": "6",
  "50-breaststroke": "7",
  "100-breaststroke": "8",
  "200-breaststroke": "9",
  "50-butterfly": "10",
  "100-butterfly": "11",
  "200-butterfly": "12",
  "50-backstroke": "13",
  "100-backstroke": "14",
  "200-backstroke": "15",
  "200-im": "16",
  "400-im": "17",
  "100-im": "18",
};

export type RankingLevel = "county" | "region" | "national";

const LEVEL_PARAMS: Record<RankingLevel, Record<string, string>> = {
  county: { Level: "C", TargetCounty: "CHRN", TargetRegion: "P", TargetNationality: "X", TargetClub: "XXXX" },
  region: { Level: "D", TargetRegion: "N", TargetCounty: "XXXX", TargetNationality: "X", TargetClub: "XXXX" },
  national: { Level: "N", TargetNationality: "X", TargetRegion: "P", TargetCounty: "XXXX", TargetClub: "XXXX" },
};

export const RANKING_LEVELS: { id: RankingLevel; label: string }[] = [
  { id: "county", label: "Cheshire" },
  { id: "region", label: "North West" },
  { id: "national", label: "National" },
];

export function rankingAge(yearOfBirth: number, ageAt: string): number | null {
  const match = ageAt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const age = Number(match[3]) - yearOfBirth;
  if (age < 8 || age > 18) return null;
  return age;
}

export function ageGroupCode(age: number): string {
  return String(age).padStart(2, "0");
}

export function rankingListUrl(input: {
  course: Course;
  strokeCode: string;
  sex: "F" | "M";
  ageGroup: string;
  ageAt: string;
  start: number;
  level: RankingLevel;
}): string {
  const url = new URL("https://www.swimmingresults.org/12months/last12.php");
  url.searchParams.set("Pool", input.course === "LC" ? "L" : "S");
  url.searchParams.set("Stroke", input.strokeCode);
  url.searchParams.set("Sex", input.sex);
  url.searchParams.set("AgeGroup", input.ageGroup);
  url.searchParams.set("date", input.ageAt);
  url.searchParams.set("StartNumber", String(input.start));
  url.searchParams.set("RecordsToView", "100");
  for (const [key, value] of Object.entries(LEVEL_PARAMS[input.level])) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
