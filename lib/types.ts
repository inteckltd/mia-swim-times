import type { EventKey } from "./events";
import type { Centiseconds } from "./time";

export type Course = "SC" | "LC";
export type Gender = "female" | "male";

export interface BestTimes {
  event: EventKey;
  shortCoursePb: Centiseconds | null;
  longCoursePb: Centiseconds | null;
  shortCourseSeason: Centiseconds | null;
  longCourseSeason: Centiseconds | null;
}

export interface SwimmerProfile {
  name: string;
  knownAs: string | null;
  yearOfBirth: number | null;
  gender: Gender | null;
  membershipNumber: string | null;
  club: string | null;
  seasonLabel: string | null;
  bests: BestTimes[];
  parseError: string | null;
}

export interface IndexEvent {
  label: string;
  session: string | null;
  dateText: string | null;
  startHref: string | null;
  resultHref: string | null;
  round: string | null;
  order: number;
}

export interface MeetIndex {
  name: string;
  events: IndexEvent[];
}

export type ResultsDocument =
  | { kind: "frameset"; frames: string[] }
  | { kind: "meet"; meet: MeetIndex }
  | { kind: "empty" };

export interface AthleteRow {
  name: string;
  club: string;
  age: string | null;
  place: number | null;
  time: Centiseconds | null;
  status: "time" | "dq" | "dns" | "dnf" | "other";
  ageGroup: string | null;
  event: EventKey | null;
  round: string | null;
}

export interface GalaSwim {
  event: EventKey;
  round: string | null;
  ageGroup: string | null;
  place: number | null;
  time: Centiseconds | null;
  status: AthleteRow["status"];
  entryTime: Centiseconds | null;
  dateText: string | null;
  order: number;
}

export interface EventCard {
  id: string;
  title: string;
  meta: string | null;
  headline: string | null;
  courseLabel: string | null;
  entry: string | null;
  pbLine: string | null;
  shortPb: string;
  longPb: string;
  summary: string;
  detail: string;
  windowLine: string | null;
  tone: "good" | "mixed" | "short";
}

export interface RankingCellModel {
  level: "county" | "region" | "national";
  label: string;
  href: string | null;
  rankLabel: string | null;
  timeLabel: string | null;
  dateLabel: string | null;
  meet: string | null;
  windowLine: string | null;
  note: string;
}

export interface RankingCourseModel {
  courseLabel: string;
  cells: RankingCellModel[];
}

export interface RankingEventModel {
  title: string;
  courses: RankingCourseModel[];
}

export interface RankingsModel {
  swimmerName: string;
  club: string;
  ageLine: string;
  seasonNote: string;
  windowNotes: string[];
  blocked: string | null;
  events: RankingEventModel[];
  warnings: string[];
  fetchedAt: string;
}

export interface DashboardModel {
  swimmerName: string;
  club: string;
  membership: string;
  ageLine: string;
  meetName: string | null;
  meetCourseLabel: string;
  resultsUrl: string | null;
  resultsHow: string;
  galaCards: EventCard[];
  otherCards: EventCard[];
  warnings: string[];
  notes: string[];
  sources: { label: string; href: string }[];
  fetchedAt: string;
}
