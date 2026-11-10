import { unstable_cache } from "next/cache";
import { getConfig, type AppConfig } from "./config";
import { buildDashboard } from "./build-view";
import { fetchText, isChallenge } from "./http";
import { namesMatch } from "./events";
import { parseBiogs } from "./parse-biogs";
import { assembleGalaSwims, isOtherGender, parseResultsDocument } from "./parse-sportsystems";
import { mapPool } from "./pool";
import { isSwimManagerLogin } from "./swimmanager";
import type { DashboardModel, MeetIndex, SwimmerProfile } from "./types";

const BIOG_URL = "https://www.swimmingresults.org/biogs/biogs_details.php";

export async function loadDashboard(): Promise<DashboardModel> {
  const config = getConfig();
  try {
    return await cachedDashboard(JSON.stringify(publicConfig(config)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The results could not be loaded.";
    return buildDashboard({
      profile: null,
      swims: [],
      meetName: null,
      meetCourse: config.meetCourse,
      rankingsAgeAt: config.rankingsAgeAt,
      fallbackName: config.swimmerName,
      membership: config.membership,
      warnings: [message],
      sources: [],
      fetchedAt: new Date().toISOString(),
    });
  }
}

const cachedDashboard = unstable_cache(
  async (encoded: string) => assembleDashboard(JSON.parse(encoded) as PublicConfig),
  ["mia-dashboard-v1"],
  { revalidate: revalidateSeconds(), tags: ["swim-data"] },
);

async function assembleDashboard(config: PublicConfig): Promise<DashboardModel> {
  const warnings: string[] = [];
  const sources: { label: string; href: string }[] = [];
  const profile = await loadProfile(config, warnings, sources);
  const meet = await loadMeet(config, warnings, sources);
  const swims = meet ? await loadSwims(config, meet, profile, warnings) : [];
  if (config.swimManagerUrl) await noteSwimManager(config.swimManagerUrl, warnings, sources);

  return buildDashboard({
    profile,
    swims,
    meetName: meet?.index.name ?? null,
    meetCourse: config.meetCourse,
    rankingsAgeAt: config.rankingsAgeAt,
    fallbackName: config.swimmerName,
    membership: config.membership,
    warnings,
    sources,
    fetchedAt: new Date().toISOString(),
  });
}

async function loadProfile(
  config: PublicConfig,
  warnings: string[],
  sources: { label: string; href: string }[],
): Promise<SwimmerProfile | null> {
  const url = `${BIOG_URL}?tiref=${encodeURIComponent(config.membership)}`;
  sources.push({ label: "Swim England biography", href: url });
  const page = await fetchText(url);
  if (isChallenge(page)) {
    warnings.push(
      "Swim England’s biography page presented a bot check, so personal bests were not loaded. Nothing has been invented in their place.",
    );
    return null;
  }
  if (!page.ok) {
    warnings.push(`The biography page did not load (${page.status || page.error || "no response"}).`);
    return null;
  }
  const profile = parseBiogs(page.text);
  if (profile.parseError) warnings.push(profile.parseError);
  if (profile.membershipNumber && profile.membershipNumber !== config.membership) {
    warnings.push("The biography membership number did not match the configured swimmer, so those times were ignored.");
    return null;
  }
  const nameOk = namesMatch(profile.name, config.swimmerName) || namesMatch(profile.knownAs ?? "", config.swimmerName);
  if (profile.name && !nameOk) {
    warnings.push(`The biography was for ${profile.name}, not ${config.swimmerName}, so those times were ignored.`);
    return null;
  }
  return profile;
}

async function loadMeet(
  config: PublicConfig,
  warnings: string[],
  sources: { label: string; href: string }[],
): Promise<{ index: MeetIndex; base: string } | null> {
  sources.push({ label: "Results index", href: config.resultsIndexUrl });
  const indexPage = await fetchText(config.resultsIndexUrl);
  if (!indexPage.ok) {
    warnings.push(`The results index did not load (${indexPage.status || indexPage.error || "no response"}).`);
    return null;
  }
  const document = parseResultsDocument(indexPage.text);
  if (document.kind === "meet") return { index: document.meet, base: indexPage.url };
  if (document.kind !== "frameset") {
    warnings.push("The results index was not a SportSystems event list or frameset.");
    return null;
  }

  let best: { index: MeetIndex; base: string } | null = null;
  for (const frame of document.frames) {
    const url = new URL(frame, indexPage.url).toString();
    const page = await fetchText(url);
    if (!page.ok) continue;
    const inner = parseResultsDocument(page.text);
    if (inner.kind === "meet" && inner.meet.events.length > (best?.index.events.length ?? 0)) {
      best = { index: inner.meet, base: page.url };
    }
  }
  if (!best) warnings.push("The results frameset did not contain an event list.");
  return best;
}

async function loadSwims(
  config: PublicConfig,
  meet: { index: MeetIndex; base: string },
  profile: SwimmerProfile | null,
  warnings: string[],
) {
  const gender = profile?.gender ?? config.gender;
  const name = profile?.name || config.swimmerName;
  const events = meet.index.events.filter((event) => event.resultHref && !isOtherGender(event.label, gender));
  const resultPages = await mapPool(events, 3, 150, async (event) => {
    const href = event.resultHref ?? "";
    const page = await fetchText(new URL(href, meet.base).toString());
    return { href, html: page.text, kind: "result" as const, ok: page.ok };
  });

  const withResults = resultPages.filter((page) => page.ok);
  const found = assembleGalaSwims({
    meet: meet.index,
    pages: withResults,
    name,
    clubMatch: config.clubMatch,
  });
  const startEvents = events.filter((event) => found.some((swim) => swim.order === event.order) && event.startHref);
  const startPages = await mapPool(startEvents, 3, 150, async (event) => {
    const href = event.startHref ?? "";
    const page = await fetchText(new URL(href, meet.base).toString());
    return { href, html: page.text, kind: "start" as const, ok: page.ok };
  });

  const failed = resultPages.filter((page) => !page.ok).length;
  if (failed > 0) warnings.push(`${failed} result page${failed === 1 ? "" : "s"} did not load.`);

  return assembleGalaSwims({
    meet: meet.index,
    pages: [...withResults, ...startPages.filter((page) => page.ok)],
    name,
    clubMatch: config.clubMatch,
  });
}

async function noteSwimManager(url: string, warnings: string[], sources: { label: string; href: string }[]) {
  sources.push({ label: "Swim Manager", href: url });
  const page = await fetchText(url);
  if (isSwimManagerLogin(page.text, page.url)) {
    warnings.push("Swim Manager asked for a club login, so entry times come from the SportSystems start lists.");
  }
}

interface PublicConfig {
  resultsIndexUrl: string;
  meetCourse: AppConfig["meetCourse"];
  swimManagerUrl: string | null;
  swimmerName: string;
  membership: string;
  clubMatch: string;
  yearOfBirth: number;
  gender: AppConfig["gender"];
  rankingsAgeAt: string;
}

function publicConfig(config: AppConfig): PublicConfig {
  return {
    resultsIndexUrl: config.resultsIndexUrl,
    meetCourse: config.meetCourse,
    swimManagerUrl: config.swimManagerUrl,
    swimmerName: config.swimmerName,
    membership: config.membership,
    clubMatch: config.clubMatch,
    yearOfBirth: config.yearOfBirth,
    gender: config.gender,
    rankingsAgeAt: config.rankingsAgeAt,
  };
}

function revalidateSeconds(): number {
  const parsed = Number(process.env.REVALIDATE_SECONDS);
  if (!Number.isFinite(parsed)) return 180;
  return Math.min(3600, Math.max(60, Math.round(parsed)));
}
