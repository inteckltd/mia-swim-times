import { unstable_cache } from "next/cache";
import { getConfig } from "./config";
import { eventId, eventLabel, namesMatch, type EventKey } from "./events";
import { fetchText, isChallenge } from "./http";
import { parseBiogs } from "./parse-biogs";
import { findRankingRow, parseRankingPage } from "./parse-rankings";
import { mapPool } from "./pool";
import {
  RANKING_LEVELS,
  STROKE_CODE,
  ageGroupCode,
  rankingAge,
  rankingListUrl,
  type RankingLevel,
} from "./ranking-query";
import { formatSwimTime, type Centiseconds } from "./time";
import type { Course, RankingCellModel, RankingsModel, SwimmerProfile } from "./types";
import { countyWindow, formatAgeAt, formatMeetDate, qualifyingWindowLine, regionalWindow } from "./windows";

const PAGE_SIZE = 100;
const MAX_FETCHES = 5;
const MAX_START = 501;
let blockedUntil = 0;

export async function loadRankings(): Promise<RankingsModel> {
  const config = getConfig();
  const seasonNote = `Last 12 months, female, age at ${formatAgeAt(config.rankingsAgeAt)}. National is the all-members list covering England, Scotland, Wales and the Crown Dependencies.`;
  const windowNotes = [countyWindow().summary, regionalWindow().summary];
  try {
    const profile = await cachedProfile(config.membership, config.swimmerName);
    const age = profile.yearOfBirth == null ? null : rankingAge(profile.yearOfBirth, config.rankingsAgeAt);
    if (profile.yearOfBirth == null || age == null) {
      return empty(profile, seasonNote, windowNotes, ["Year of birth or the rankings age date could not be used."]);
    }
    const jobs = rankingJobs(profile, age, config.rankingsAgeAt, profile.gender === "male" ? "M" : "F");
    const cells = await mapPool(jobs, 2, 250, (job) => loadJob(job, profile));
    return {
      swimmerName: profile.name || config.swimmerName,
      club: profile.club || "Club not loaded",
      ageLine: `Born ${profile.yearOfBirth}. These places are among girls aged ${age} at ${formatAgeAt(config.rankingsAgeAt)}.`,
      seasonNote,
      windowNotes,
      blocked: cells.length > 0 && cells.every((cell) => cell.blocked) ? blockedMessage() : null,
      events: cells.length > 0 && cells.every((cell) => cell.blocked) ? [] : groupEvents(jobs, cells),
      warnings: cells.filter((cell) => cell.warning).map((cell) => cell.warning as string),
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rankings could not be loaded.";
    return {
      swimmerName: config.swimmerName,
      club: "Club not loaded",
      ageLine: message,
      seasonNote,
      windowNotes,
      blocked: /bot check|challenge|blocked/i.test(message) ? message : null,
      events: [],
      warnings: [/bot check|challenge|blocked/i.test(message) ? "" : message].filter(Boolean),
      fetchedAt: new Date().toISOString(),
    };
  }
}

interface Job {
  event: EventKey;
  course: Course;
  level: RankingLevel;
  target: Centiseconds;
  age: number;
  ageAt: string;
  sex: "F" | "M";
}

interface JobResult {
  job: Job;
  cell: RankingCellModel;
  blocked: boolean;
  warning: string | null;
}

function rankingJobs(profile: SwimmerProfile, age: number, ageAt: string, sex: "F" | "M"): Job[] {
  const jobs: Job[] = [];
  for (const best of profile.bests) {
    const courses: { course: Course; time: Centiseconds | null }[] = [
      { course: "SC", time: best.shortCourseSeason ?? best.shortCoursePb },
      { course: "LC", time: best.longCourseSeason ?? best.longCoursePb },
    ];
    for (const item of courses) {
      if (item.time == null || !STROKE_CODE[eventId(best.event)]) continue;
      for (const level of RANKING_LEVELS) {
        jobs.push({ event: best.event, course: item.course, level: idOf(level.id), target: item.time, age, ageAt, sex });
      }
    }
  }
  return jobs;
}

async function loadJob(job: Job, profile: SwimmerProfile): Promise<JobResult> {
  const label = `${RANKING_LEVELS.find((level) => level.id === job.level)?.label} ${eventLabel(job.event)} ${job.course === "SC" ? "short course" : "long course"}`;
  try {
    const cell = await cachedCell(cellKey(job, profile.membershipNumber ?? ""));
    return { job, cell, blocked: false, warning: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "This rankings page did not load.";
    const blocked = /bot check/i.test(message);
    return {
      job,
      cell: baseCell(job, blocked ? "Swim England presented a bot check, so this place was not loaded." : "This rankings page did not load."),
      blocked,
      warning: blocked ? null : `${label} did not load.`,
    };
  }
}

const cachedProfile = unstable_cache(
  async (membership: string, expectedName: string) => {
    const page = await fetchText(`https://www.swimmingresults.org/biogs/biogs_details.php?tiref=${encodeURIComponent(membership)}`);
    if (isChallenge(page)) throw new Error("Swim England presented a bot check, so rankings were not loaded.");
    if (!page.ok) throw new Error(`The biography page did not load (${page.status || page.error || "no response"}).`);
    const profile = parseBiogs(page.text);
    if (profile.membershipNumber && profile.membershipNumber !== membership) {
      throw new Error("The biography membership number did not match, so rankings were not loaded.");
    }
    if (profile.name && !namesMatch(profile.name, expectedName) && !namesMatch(profile.knownAs ?? "", expectedName)) {
      throw new Error(`The biography was for ${profile.name}, so rankings were not loaded.`);
    }
    return profile;
  },
  ["mia-ranking-profile-v1"],
  { revalidate: 3600, tags: ["rankings-data"] },
);

const cachedCell = unstable_cache(
  async (key: string) => {
    const cell = await fetchCell(JSON.parse(key) as StoredJob);
    return cell;
  },
  ["mia-ranking-cell-v3"],
  { revalidate: rankingRevalidate(), tags: ["rankings-data"] },
);

interface StoredJob extends Job {
  membership: string;
  name: string;
}

function cellKey(job: Job, membership: string): string {
  const config = getConfig();
  const stored: StoredJob = { ...job, membership, name: config.swimmerName };
  return JSON.stringify(stored);
}

async function fetchCell(job: StoredJob): Promise<RankingCellModel> {
  if (Date.now() < blockedUntil) throw new Error("Swim England presented a bot check, so rankings were not loaded.");
  const stroke = STROKE_CODE[eventId(job.event)];
  if (!stroke) throw new Error("This event has no rankings code.");
  let start = 1;
  const seen = new Set<number>();
  let checkedThrough = 0;
  let listEnded = false;

  for (let attempt = 0; attempt < MAX_FETCHES && start <= MAX_START; attempt += 1) {
    if (seen.has(start)) break;
    seen.add(start);
    const href = rankingListUrl({
      course: job.course,
      strokeCode: stroke,
      sex: job.sex,
      ageGroup: ageGroupCode(job.age),
      ageAt: job.ageAt,
      start,
      level: job.level,
    });
    const page = await fetchText(href);
    if (isChallenge(page)) {
      blockedUntil = Date.now() + 15 * 60 * 1000;
      throw new Error("Swim England presented a bot check, so rankings were not loaded.");
    }
    if (!page.ok) throw new Error(page.error || `HTTP ${page.status}`);
    if (!/id=["']rankTable["']/i.test(page.text)) throw new Error("The rankings page had no results table.");
    const table = parseRankingPage(page.text);
    const row = findRankingRow(table, job.membership, job.name);
    if (row) {
      return {
        ...baseCell(job, ""),
        href,
        rankLabel: ordinal(row.rank),
        timeLabel: row.time == null ? null : formatSwimTime(row.time),
        dateLabel: formatMeetDate(row.dateText),
        meet: row.meet,
        windowLine: qualifyingWindowLine(row.dateText),
        note: row.dateText ? "" : "The rankings row did not include a date.",
      };
    }
    checkedThrough = Math.max(checkedThrough, start + Math.max(table.rows.length, 1) - 1);
    if (table.rows.length < PAGE_SIZE) {
      listEnded = true;
      break;
    }
    start += table.rows.length;
  }

  const href = rankingListUrl({
    course: job.course,
    strokeCode: stroke,
    sex: job.sex,
    ageGroup: ageGroupCode(job.age),
    ageAt: job.ageAt,
    start: 1,
    level: job.level,
  });
  if (listEnded) {
    return { ...baseCell(job, "No swim in this list for the last 12 months."), href };
  }
  const checked = checkedThrough > 0 ? `the top ${checkedThrough}` : "the pages checked";
  return { ...baseCell(job, `Not found in ${checked}. A deeper place is not shown, because it was not on the pages read.`), href };
}

function groupEvents(jobs: Job[], results: JobResult[]) {
  const byEvent = new Map<string, { title: string; courses: Map<Course, RankingCellModel[]> }>();
  for (const result of results) {
    const id = eventId(result.job.event);
    const event = byEvent.get(id) ?? { title: eventLabel(result.job.event), courses: new Map() };
    const cells = event.courses.get(result.job.course) ?? [];
    cells.push(result.cell);
    event.courses.set(result.job.course, cells);
    byEvent.set(id, event);
  }
  const order = jobs.map((job) => eventId(job.event));
  return [...byEvent.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([, event]) => ({
      title: event.title,
      courses: (["SC", "LC"] as Course[])
        .filter((course) => event.courses.has(course))
        .map((course) => ({
          courseLabel: course === "SC" ? "Short course" : "Long course",
          cells: event.courses.get(course) ?? [],
        })),
    }));
}

function baseCell(job: Job, note: string): RankingCellModel {
  const label = RANKING_LEVELS.find((level) => level.id === job.level)?.label ?? job.level;
  return {
    level: job.level,
    label,
    href: null,
    rankLabel: null,
    timeLabel: null,
    dateLabel: null,
    meet: null,
    windowLine: null,
    note,
  };
}

function empty(profile: SwimmerProfile, seasonNote: string, windowNotes: string[], warnings: string[]): RankingsModel {
  return {
    swimmerName: profile.name,
    club: profile.club || "Club not loaded",
    ageLine: warnings[0] ?? "",
    seasonNote,
    windowNotes,
    blocked: null,
    events: [],
    warnings,
    fetchedAt: new Date().toISOString(),
  };
}

function blockedMessage(): string {
  return "Swim England presented a bot check on the rankings pages. Places are not shown, and none have been filled in.";
}

function idOf(level: RankingLevel): RankingLevel {
  return level;
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  const mod10 = value % 10;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : mod10 === 1 ? "st" : mod10 === 2 ? "nd" : mod10 === 3 ? "rd" : "th";
  return `${value}${suffix}`;
}

function rankingRevalidate(): number {
  const parsed = Number(process.env.RANKINGS_REVALIDATE_SECONDS);
  if (!Number.isFinite(parsed)) return 3600;
  return Math.min(86400, Math.max(300, Math.round(parsed)));
}
