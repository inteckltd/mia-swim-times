import standardsFile from "@/data/qualifying-times.json";
import { eventLabel, type EventKey, eventId } from "./events";
import { parseSwimTime, type Centiseconds } from "./time";
import type { Course, Gender } from "./types";

interface BandFile {
  label: string;
  minAge: number;
  maxAge: number;
  events: Record<string, string | null>;
}

interface StandardFile {
  id: string;
  name: string;
  shortLabel: string;
  kind: "consideration" | "qualifying";
  season: string;
  ageAtEndOfYear: number;
  course: Course;
  acceptsConverted: boolean;
  sourceUrl: string;
  sourceChecked: string;
  bands: BandFile[];
}

const file = standardsFile as {
  notes: string[];
  county: StandardFile;
  regional: StandardFile;
};

export interface StandardTarget {
  id: string;
  name: string;
  shortLabel: string;
  kind: "consideration" | "qualifying";
  season: string;
  ageAtEndOfYear: number;
  course: Course;
  sourceUrl: string;
  time: Centiseconds | null;
  age: number;
  bandLabel: string | null;
  eventName: string;
  applicable: boolean;
}

export function standardsNotes(): string[] {
  return file.notes;
}

export function championshipYears(yearOfBirth: number): { age: number; year: number } {
  return { age: file.county.ageAtEndOfYear - yearOfBirth, year: file.county.ageAtEndOfYear };
}

export function countyStandard(event: EventKey, yearOfBirth: number, gender: Gender | null): StandardTarget {
  return lookup(file.county, event, yearOfBirth, gender);
}

export function regionalStandard(event: EventKey, yearOfBirth: number, gender: Gender | null): StandardTarget {
  return lookup(file.regional, event, yearOfBirth, gender);
}

function lookup(standard: StandardFile, event: EventKey, yearOfBirth: number, gender: Gender | null): StandardTarget {
  const age = standard.ageAtEndOfYear - yearOfBirth;
  const base = {
    id: standard.id,
    name: standard.name,
    shortLabel: standard.shortLabel,
    kind: standard.kind,
    season: standard.season,
    ageAtEndOfYear: standard.ageAtEndOfYear,
    course: standard.course,
    sourceUrl: standard.sourceUrl,
    age,
    eventName: eventLabel(event),
    applicable: gender === "female",
  };
  if (gender !== "female") {
    return { ...base, time: null, bandLabel: null };
  }
  const band = standard.bands.find((item) => age >= item.minAge && age <= item.maxAge);
  if (!band) return { ...base, time: null, bandLabel: null };
  const raw = band.events[eventId(event)];
  return {
    ...base,
    bandLabel: band.label,
    time: raw ? parseSwimTime(raw) : null,
  };
}
