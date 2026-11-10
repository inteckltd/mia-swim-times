import { eventId, type EventKey } from "./events";
import type { Course } from "./types";
import type { Centiseconds } from "./time";

/**
 * Swim England / SPORTSYSTEMS equivalent time algorithm (Graham Sykes),
 * 25m short course and 50m long course only.
 * https://www.swimmingresults.org/downloads/equivalent-time-share/algorithm.php
 *
 * Turn factors are the metric-pool values published on that page.
 * 100m IM is not in the table, so it is left unconverted.
 */
const TURN_FACTOR: Record<string, number> = {
  "50-freestyle": 42.245,
  "100-freestyle": 42.245,
  "200-freestyle": 43.786,
  "400-freestyle": 44.233,
  "800-freestyle": 45.525,
  "1500-freestyle": 46.221,
  "50-breaststroke": 63.616,
  "100-breaststroke": 63.616,
  "200-breaststroke": 66.598,
  "50-butterfly": 38.269,
  "100-butterfly": 38.269,
  "200-butterfly": 39.76,
  "50-backstroke": 40.5,
  "100-backstroke": 40.5,
  "200-backstroke": 41.98,
  "200-im": 49.7,
  "400-im": 55.366,
};

export function convertCourse(
  time: Centiseconds,
  from: Course,
  to: Course,
  event: EventKey,
): Centiseconds | null {
  if (from === to) return time;
  const factor = TURN_FACTOR[eventId(event)];
  if (factor == null || time <= 0) return null;
  const seconds = time / 100;
  const turns = ((event.distance / 100) ** 2) * 2;
  if (from === "SC" && to === "LC") {
    const longCourse =
      (seconds + Math.sqrt(seconds * seconds + 4 * factor * turns)) / 2;
    return roundToTenth(longCourse);
  }
  if (from === "LC" && to === "SC") {
    const shortCourse = seconds - (factor / seconds) * turns;
    return roundToTenth(shortCourse);
  }
  return null;
}

/** Official rounding: add 0.05s and drop the hundredths, leaving a tenth. */
function roundToTenth(seconds: number): Centiseconds {
  const tenths = Math.floor(seconds * 10 + 0.5 + 1e-8);
  return tenths * 10;
}
