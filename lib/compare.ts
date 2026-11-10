import { convertCourse } from "./convert";
import { eventLabel, type EventKey } from "./events";
import { countyStandard, regionalStandard } from "./standards";
import { formatGap, formatSwimTime, type Centiseconds } from "./time";
import type { Course, Gender } from "./types";

export interface TimedSwim {
  course: Course;
  time: Centiseconds | null;
}

export interface Comparison {
  summary: string;
  detail: string;
  tone: "good" | "mixed" | "short";
}

interface Candidate {
  time: Centiseconds;
  label: string;
  preference: number;
}

export function compareStandards(input: {
  event: EventKey;
  gender: Gender | null;
  yearOfBirth: number;
  swim: TimedSwim | null;
  shortCoursePb: Centiseconds | null;
  longCoursePb: Centiseconds | null;
}): Comparison {
  const county = countyStandard(input.event, input.yearOfBirth, input.gender);
  const regional = regionalStandard(input.event, input.yearOfBirth, input.gender);
  const countyBest = bestTime(county.course, input);
  const regionalBest = bestTime(regional.course, input);

  const countyPhrase = phrase(county, countyBest);
  const regionalPhrase = phrase(regional, regionalBest);
  const summary = capitalize(`${countyPhrase}; ${regionalPhrase}.`.replace(".;", ";"));
  const detail = [
    describe(county, countyBest),
    describe(regional, regionalBest),
  ].join(" ");
  return { summary, detail, tone: toneOf(summary) };
}

export function pbLine(swim: Centiseconds | null, pb: Centiseconds | null, course: Course): string | null {
  if (swim == null) return null;
  const name = course === "SC" ? "short course PB" : "long course PB";
  if (pb == null) return `No ${name} on file`;
  const delta = swim - pb;
  if (delta === 0) {
    return `The published ${name} is this race, so it is not used as the time from before the meet.`;
  }
  if (delta < 0) return `−${formatGap(-delta)} vs the ${name} from before this result`;
  return `+${formatGap(delta)} vs the published ${name}`;
}

function sameAsThisSwim(
  time: Centiseconds | null,
  course: Course,
  swim: TimedSwim | null,
): boolean {
  return time != null && swim?.time != null && swim.course === course && swim.time === time;
}

function bestTime(
  target: Course,
  input: {
    event: EventKey;
    swim: TimedSwim | null;
    shortCoursePb: Centiseconds | null;
    longCoursePb: Centiseconds | null;
  },
): Candidate | null {
  const found: Candidate[] = [];
  const push = (time: Centiseconds | null, from: Course, label: string, preference: number) => {
    if (time == null) return;
    if (from === target) {
      found.push({ time, label, preference });
      return;
    }
    const converted = convertCourse(time, from, target, input.event);
    if (converted == null) return;
    const courseName = target === "LC" ? "long course" : "short course";
    found.push({
      time: converted,
      label: `${label}, converted to ${courseName}`,
      preference: preference + 5,
    });
  };

  if (input.swim?.time != null) {
    const courseName = input.swim.course === "SC" ? "short course" : "long course";
    push(input.swim.time, input.swim.course, `this ${courseName} swim`, 0);
  }
  if (!sameAsThisSwim(input.shortCoursePb, "SC", input.swim)) {
    push(input.shortCoursePb, "SC", "short course PB from before this result", 1);
  }
  if (!sameAsThisSwim(input.longCoursePb, "LC", input.swim)) {
    push(input.longCoursePb, "LC", "long course PB from before this result", 2);
  }
  found.sort((a, b) => a.time - b.time || a.preference - b.preference);
  return found[0] ?? null;
}

function phrase(
  standard: { shortLabel: string; kind: "consideration" | "qualifying"; time: Centiseconds | null; age: number; eventName: string; bandLabel: string | null; applicable: boolean },
  best: Candidate | null,
): string {
  if (!standard.applicable) return `no ${standard.shortLabel} times loaded for this category`;
  if (standard.time == null) {
    if (standard.bandLabel == null && standard.kind === "consideration") {
      return `no ${standard.shortLabel} consideration time for age ${standard.age}`;
    }
    return `no ${standard.shortLabel} ${standard.kind === "consideration" ? "consideration" : "qualifying"} time for ${standard.eventName}`;
  }
  if (!best) return `no time to compare with the ${standard.shortLabel} standard`;
  const margin = best.time - standard.time;
  const gap = formatGap(Math.abs(margin));
  if (margin < 0) return `achieved ${standard.shortLabel} by ${gap}`;
  if (margin === 0) return `achieved the ${standard.shortLabel} time`;
  return `needs ${gap} more for ${standard.shortLabel}`;
}

function describe(
  standard: { name: string; course: Course; time: Centiseconds | null; kind: "consideration" | "qualifying"; bandLabel: string | null; age: number; applicable: boolean },
  best: Candidate | null,
): string {
  if (!standard.applicable) return `${standard.name}: girls' times are the standards loaded in this app.`;
  const course = standard.course === "SC" ? "short course" : "long course";
  if (standard.time == null) {
    const which = standard.kind === "consideration" ? "consideration time" : "qualifying time";
    return `${standard.name}: no ${course} ${which} for ${standard.bandLabel ? `age ${standard.bandLabel}` : `age ${standard.age}`}.`;
  }
  if (!best) {
    return `${standard.name}: ${formatSwimTime(standard.time)} ${course}, but there is no time on that course to compare.`;
  }
  return `${standard.name}: ${best.label} (${formatSwimTime(best.time)}) against ${formatSwimTime(standard.time)} ${course}.`;
}

function toneOf(summary: string): Comparison["tone"] {
  const achieved = /achieved/i.test(summary);
  const needs = /needs/i.test(summary);
  if (achieved && !needs) return "good";
  if (achieved && needs) return "mixed";
  return "short";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
