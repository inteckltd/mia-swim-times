import { parse, type HTMLElement } from "node-html-parser";
import { clubMatches, namesMatch, parseEventLabel, type EventKey } from "./events";
import { parseSwimTime } from "./time";
import type { AthleteRow, GalaSwim, IndexEvent, MeetIndex, ResultsDocument } from "./types";

export function parseResultsDocument(html: string): ResultsDocument {
  if (/<frameset\b/i.test(html)) {
    const frames = [...html.matchAll(/<frame\b[^>]*\ssrc=["']?([^"'\s>]+)/gi)].map((match) => match[1]);
    if (frames.length > 0) return { kind: "frameset", frames };
  }
  const meet = parseMeetPage(html);
  if (!meet.events.length && !meet.name) return { kind: "empty" };
  return { kind: "meet", meet };
}

export function parseMeetPage(html: string): MeetIndex {
  const root = parse(html);
  const name = clean(root.querySelector("h1, h2"));
  const events: IndexEvent[] = [];
  let session: string | null = null;
  let dateText: string | null = null;
  let order = 0;

  for (const node of root.querySelectorAll("h3, tr")) {
    if (node.tagName === "H3") {
      const text = clean(node);
      session = text;
      dateText = text.match(/\d{2}\/\d{2}\/\d{2}/)?.[0] ?? dateText;
      continue;
    }
    const links = node.querySelectorAll("a");
    if (links.length === 0) continue;
    const label = clean(node.querySelector("td"));
    if (!label || /^pdf/i.test(label)) continue;
    let startHref: string | null = null;
    let resultHref: string | null = null;
    let round: string | null = null;
    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      if (!/\.html?$/i.test(href)) continue;
      const kind = linkKind(href, clean(link));
      if (kind === "start") startHref = href;
      if (kind === "result") {
        resultHref = href;
        round = clean(link) || round;
      }
    }
    if (!startHref && !resultHref) continue;
    events.push({ label, session, dateText, startHref, resultHref, round, order });
    order += 1;
  }

  return { name, events };
}

export function parseResultPage(html: string): {
  event: EventKey | null;
  round: string | null;
  rows: AthleteRow[];
} {
  const prepared = html.replace(/\u0000/g, "");
  const root = parse(prepared);
  let event: EventKey | null = null;
  let round: string | null = null;
  let ageGroup: string | null = null;
  const rows: AthleteRow[] = [];

  for (const node of root.querySelectorAll("h3, table")) {
    if (node.tagName === "H3") {
      const text = clean(node);
      if (/age group/i.test(text)) {
        ageGroup = cleanAgeGroup(text);
      } else {
        event = parseEventLabel(text) ?? event;
        round = /final/i.test(text) ? "Final" : /heat/i.test(text) ? "Heats" : round;
        ageGroup = null;
      }
      continue;
    }
    rows.push(...rowsFromTable(node, event, round, ageGroup));
  }

  return { event, round, rows };
}

export function matchingRows(rows: AthleteRow[], name: string, clubMatch: string): AthleteRow[] {
  return rows.filter((row) => namesMatch(row.name, name) && clubMatches(row.club, clubMatch));
}

export function isOtherGender(label: string, gender: "female" | "male"): boolean {
  const text = label.toLowerCase();
  if (gender === "female") return text.includes("open/male") || /^\s*male\b/.test(text);
  return text.includes("female");
}

export function assembleGalaSwims(input: {
  meet: MeetIndex;
  pages: { href: string; html: string; kind: "result" | "start" }[];
  name: string;
  clubMatch: string;
}): GalaSwim[] {
  const byFile = new Map<string, { href: string; html: string; kind: "result" | "start" }>();
  for (const page of input.pages) byFile.set(fileName(page.href), page);

  const swims: GalaSwim[] = [];
  for (const event of input.meet.events) {
    const result = event.resultHref ? byFile.get(fileName(event.resultHref)) : undefined;
    if (!result) continue;
    const parsed = parseResultPage(result.html);
    const found = matchingRows(parsed.rows, input.name, input.clubMatch);
    if (found.length === 0 || !parsed.event) continue;
    const chosen = chooseRow(found);
    const start = event.startHref ? byFile.get(fileName(event.startHref)) : undefined;
    const entry = start
      ? matchingRows(parseResultPage(start.html).rows, input.name, input.clubMatch).find((row) => row.time != null)
      : undefined;
    swims.push({
      event: parsed.event,
      round: parsed.round ?? event.round,
      ageGroup: chosen.ageGroup,
      place: chosen.place,
      time: chosen.time,
      status: chosen.status,
      entryTime: entry?.time ?? null,
      dateText: event.dateText,
      order: event.order,
    });
  }
  return swims.sort((a, b) => a.order - b.order);
}

function chooseRow(rows: AthleteRow[]): AthleteRow {
  const timed = rows.filter((row) => row.time != null);
  if (timed.length === 0) return rows[0];
  return timed.reduce((best, row) => (row.time! < best.time! ? row : best));
}

function rowsFromTable(
  table: HTMLElement,
  event: EventKey | null,
  round: string | null,
  ageGroup: string | null,
): AthleteRow[] {
  const body = table.querySelectorAll("tr").map((row) => row.querySelectorAll("td").map((cell) => clean(cell)));
  const headerIndex = body.findIndex((cells) => cells.some((cell) => cell.toLowerCase() === "name"));
  if (headerIndex < 0) return [];
  const header = body[headerIndex].map((cell) => cell.toLowerCase());
  const nameAt = header.indexOf("name");
  const clubAt = header.indexOf("club");
  const timeAt = header.indexOf("time");
  const placeAt = header.indexOf("place");
  const ageAt = header.indexOf("aad");
  if (nameAt < 0 || timeAt < 0) return [];

  const rows: AthleteRow[] = [];
  for (const cells of body.slice(headerIndex + 1)) {
    const name = cells[nameAt] ?? "";
    if (!name || name.toLowerCase() === "name") continue;
    const rawTime = cells[timeAt] ?? "";
    const status = statusFrom(rawTime);
    rows.push({
      name,
      club: clubAt >= 0 ? (cells[clubAt] ?? "") : "",
      age: ageAt >= 0 ? cells[ageAt] || null : null,
      place: placeAt >= 0 ? parsePlace(cells[placeAt] ?? "") : null,
      time: status === "time" ? parseSwimTime(rawTime) : null,
      status,
      ageGroup,
      event,
      round,
    });
  }
  return rows;
}

function statusFrom(raw: string): AthleteRow["status"] {
  const text = raw.replace(/\u0000/g, "").trim().toUpperCase();
  if (text.startsWith("DQ")) return "dq";
  if (text.startsWith("DNS")) return "dns";
  if (text.startsWith("DNF")) return "dnf";
  if (!parseSwimTime(raw)) return text ? "other" : "time";
  return "time";
}

function parsePlace(value: string): number | null {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function cleanAgeGroup(text: string): string {
  const match = text.match(/(\d+)\s*yrs/i);
  return match ? `${Number(match[1])} yrs` : text;
}

function linkKind(href: string, text: string): "start" | "result" | "other" {
  const file = fileName(href);
  if (/^s.*\.html?$/.test(file) || text.toLowerCase() === "start") return "start";
  if (/^r.*\.html?$/.test(file) || /^(heats|final|finals|results)$/i.test(text)) return "result";
  return "other";
}

function fileName(href: string): string {
  return href.split("?")[0].split("/").pop()?.toLowerCase() ?? href.toLowerCase();
}

function clean(node: HTMLElement | null): string {
  if (!node) return "";
  return node.text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
