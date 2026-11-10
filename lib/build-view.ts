import { compareStandards, pbLine } from "./compare";
import { EVENT_ORDER, eventId, eventLabel } from "./events";
import { formatSignedGap, formatSwimTime, type Centiseconds } from "./time";
import type { Course, DashboardModel, EventCard, GalaSwim, SwimmerProfile } from "./types";
import { championshipYears } from "./standards";
import { formatAgeAt, formatMeetDate, qualifyingWindowLine } from "./windows";
import { rankingAge } from "./ranking-query";

export function buildDashboard(input: {
  profile: SwimmerProfile | null;
  swims: GalaSwim[];
  meetName: string | null;
  meetCourse: Course;
  resultsUrl?: string | null;
  resultsHow?: string;
  rankingsAgeAt: string;
  fallbackName: string;
  membership: string;
  warnings: string[];
  notes?: string[];
  sources: { label: string; href: string }[];
  fetchedAt: string;
}): DashboardModel {
  const profile = input.profile;
  const year = profile?.yearOfBirth ?? null;
  const rankedAge = year == null ? null : rankingAge(year, input.rankingsAgeAt);
  const galaIds = new Set(input.swims.map((swim) => eventId(swim.event)));

  const galaCards = input.swims.map((swim) =>
    cardFor(swim, profile, input.meetCourse, year),
  );
  const otherCards = (profile?.bests ?? [])
    .filter((best) => !galaIds.has(eventId(best.event)))
    .filter((best) => best.shortCoursePb != null || best.longCoursePb != null)
    .sort((a, b) => orderOf(eventId(a.event)) - orderOf(eventId(b.event)))
    .map((best) => cardFor(null, profile, input.meetCourse, year, best.event));

  return {
    swimmerName: profile?.name || input.fallbackName,
    club: profile?.club || "Club not loaded",
    membership: profile?.membershipNumber || input.membership,
    ageLine: ageLine(year, rankedAge, input.rankingsAgeAt),
    meetName: input.meetName,
    meetCourseLabel: input.meetCourse === "SC" ? "Short course, 25m" : "Long course, 50m",
    resultsUrl: input.resultsUrl ?? null,
    resultsHow: input.resultsHow ?? "",
    galaCards,
    otherCards,
    warnings: input.warnings,
    notes: input.notes ?? [],
    sources: input.sources,
    fetchedAt: input.fetchedAt,
  };
}

function cardFor(
  swim: GalaSwim | null,
  profile: SwimmerProfile | null,
  meetCourse: Course,
  year: number | null,
  fallbackEvent = swim?.event,
): EventCard {
  const event = fallbackEvent ?? { distance: 0, stroke: "freestyle" as const };
  const best = profile?.bests.find((item) => eventId(item.event) === eventId(event));
  const course = swim ? meetCourse : "SC";
  const samePb = course === "SC" ? best?.shortCoursePb ?? null : best?.longCoursePb ?? null;
  const comparison =
    year == null
      ? null
      : compareStandards({
          event,
          gender: profile?.gender ?? null,
          yearOfBirth: year,
          swim: swim ? { course: meetCourse, time: swim.time } : null,
          shortCoursePb: best?.shortCoursePb ?? null,
          longCoursePb: best?.longCoursePb ?? null,
        });

  return {
    id: swim ? `${eventId(event)}-${swim.order}` : eventId(event),
    title: event.distance ? eventLabel(event) : "Event",
    meta: swim ? metaLine(swim) : null,
    headline: swim ? headline(swim) : null,
    courseLabel: swim ? (meetCourse === "SC" ? "Short course" : "Long course") : null,
    entry: entryLine(swim),
    pbLine: swim ? pbLine(swim.time, samePb, meetCourse) : null,
    shortPb: showTime(best?.shortCoursePb ?? null),
    longPb: showTime(best?.longCoursePb ?? null),
    summary: comparison?.summary ?? "Personal bests are not available, so this time is not compared with a qualifying standard.",
    detail: comparison?.detail ?? "",
    windowLine: swim ? qualifyingWindowLine(swim.dateText) : null,
    tone: comparison?.tone ?? "short",
  };
}

function headline(swim: GalaSwim): string {
  if (swim.time != null) return formatSwimTime(swim.time);
  if (swim.status === "dq") return "Disqualified";
  if (swim.status === "dns") return "Did not start";
  if (swim.status === "dnf") return "Did not finish";
  return "No time";
}

function entryLine(swim: GalaSwim | null): string | null {
  if (!swim?.entryTime || swim.time == null) return null;
  return `${formatSignedGap(swim.time - swim.entryTime)} against the entry time ${formatSwimTime(swim.entryTime)}`;
}

function metaLine(swim: GalaSwim): string | null {
  const parts = [
    swim.place != null ? ordinal(swim.place) : null,
    swim.ageGroup,
    swim.round,
    formatMeetDate(swim.dateText),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function showTime(time: Centiseconds | null): string {
  return time == null ? "—" : formatSwimTime(time);
}

function ageLine(year: number | null, rankedAge: number | null, ageAt: string): string {
  if (year == null || rankedAge == null) {
    return "Year of birth was not loaded, so age-group rankings and qualifying times cannot be matched.";
  }
  const championship = championshipYears(year);
  return `Born ${year}. Rankings are girls aged ${rankedAge} at ${formatAgeAt(ageAt)}, on Swim England's last-12-months lists. County and North West standards use age ${championship.age} at 31 Dec ${championship.year}, the same birth year.`;
}

function orderOf(id: string): number {
  const index = EVENT_ORDER.indexOf(id);
  return index === -1 ? EVENT_ORDER.length : index;
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  const mod10 = value % 10;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : mod10 === 1 ? "st" : mod10 === 2 ? "nd" : mod10 === 3 ? "rd" : "th";
  return `${value}${suffix}`;
}
