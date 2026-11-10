import { fetchText } from "./http";
import { parseResultsDocument } from "./parse-sportsystems";

export type ResultsAssessment =
  | { ok: true; kind: "frameset"; frames: string[]; meetName: string }
  | { ok: true; kind: "meet"; meetName: string }
  | { ok: false; error: string };

/** True when the existing SportSystems parser recognises a meet index. */
export function assessResultsHtml(html: string): ResultsAssessment {
  const doc = parseResultsDocument(html);
  if (doc.kind === "frameset") {
    return { ok: true, kind: "frameset", frames: doc.frames, meetName: "SportSystems meet" };
  }
  if (doc.kind === "meet" && doc.meet.events.length > 0) {
    return { ok: true, kind: "meet", meetName: doc.meet.name || "SportSystems meet" };
  }
  return {
    ok: false,
    error: "That page is not a SportSystems meet index. Paste the meet link, usually index.htm.",
  };
}

export function httpUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.toString();
}

export async function validateResultsLink(
  raw: string,
): Promise<{ ok: true; url: string; meetName: string } | { ok: false; error: string }> {
  const url = httpUrl(raw);
  if (!url) return { ok: false, error: "Paste a full link, starting with https://." };
  const page = await fetchText(url);
  if (!page.ok) {
    return { ok: false, error: `That link did not load (${page.status || page.error || "no response"}).` };
  }
  const direct = assessResultsHtml(page.text);
  if (!direct.ok) return direct;
  if (direct.kind === "meet") return { ok: true, url: page.url, meetName: direct.meetName };
  for (const frame of direct.frames) {
    let frameUrl: string;
    try {
      frameUrl = new URL(frame, page.url).toString();
    } catch {
      continue;
    }
    const inner = await fetchText(frameUrl);
    if (!inner.ok) continue;
    const parsed = assessResultsHtml(inner.text);
    if (parsed.ok && parsed.kind === "meet") {
      return { ok: true, url: page.url, meetName: parsed.meetName };
    }
  }
  return { ok: false, error: "That frameset did not contain a SportSystems event list." };
}
