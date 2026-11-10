import type { Course, Gender } from "./types";

export interface AppConfig {
  passcode: string | null;
  /** Last resort when Settings is empty and the club page has no results link. */
  resultsIndexUrl: string | null;
  meetCourse: Course;
  swimManagerUrl: string | null;
  swimmerName: string;
  membership: string;
  clubMatch: string;
  yearOfBirth: number;
  gender: Gender;
  revalidateSeconds: number;
  rankingsRevalidateSeconds: number;
  rankingsAgeAt: string;
}

const DEFAULT_MEET = "https://warringtonw.swimmanager.co.uk/meets/252367";

export function getConfig(): AppConfig {
  const course = process.env.MEET_COURSE?.toUpperCase() === "LC" ? "LC" : "SC";
  const swimManager = process.env.SWIMMANAGER_MEET_URL;
  return {
    passcode: process.env.APP_PASSCODE?.trim() || null,
    resultsIndexUrl: process.env.RESULTS_INDEX_URL?.trim() || null,
    meetCourse: course,
    swimManagerUrl: swimManager === undefined ? DEFAULT_MEET : swimManager.trim() || null,
    swimmerName: process.env.SWIMMER_NAME?.trim() || "Mia Clarke",
    membership: process.env.SWIMMER_MEMBERSHIP?.trim() || "1820449",
    clubMatch: process.env.SWIMMER_CLUB_MATCH?.trim() || "Warrington",
    yearOfBirth: numberFrom(process.env.SWIMMER_YEAR_OF_BIRTH, 2016),
    gender: process.env.SWIMMER_GENDER?.toLowerCase() === "male" ? "male" : "female",
    revalidateSeconds: clamp(numberFrom(process.env.REVALIDATE_SECONDS, 120), 120, 300),
    rankingsRevalidateSeconds: clamp(numberFrom(process.env.RANKINGS_REVALIDATE_SECONDS, 3600), 300, 86400),
    rankingsAgeAt: process.env.RANKINGS_AGE_AT?.trim() || "31/12/2026",
  };
}

function numberFrom(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
