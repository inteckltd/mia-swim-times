import { fetchText } from "./http";

/** The club page that links to the current SportSystems meet. */
export const CLUB_RESULTS_PAGE = "https://www.swimwarriors.org.uk/liveresults";

/**
 * Used only when the club page has no results link.
 * The club replaces the files at this address for each meet. An old
 * Percy Mason 2024 short link now opens whatever meet is published here.
 */
export const FALLBACK_RESULTS_INDEX = "https://swimwarriors.z33.web.core.windows.net/index.htm";

export interface ResultsSource {
  url: string;
  how: string;
}

export function findResultsIndex(html: string): string | null {
  const hrefs = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((match) =>
    match[1].replace(/&amp;/gi, "&").trim(),
  );
  const onResultsHost = hrefs.filter((href) => /swimwarriors\.z33\.web\.core\.windows\.net/i.test(href));
  const index = onResultsHost.find((href) => /index\.html?$/i.test(href.split("?")[0]));
  return index ?? onResultsHost[0] ?? null;
}

export function chooseResultsSource(input: {
  saved: { url: string; savedAt: string } | null;
  discovered: string | null;
  fallback: string | null;
}): ResultsSource {
  if (input.saved) {
    const when = formatSaved(input.saved.savedAt);
    return {
      url: input.saved.url,
      how: `Using the link saved in Settings${when ? ` on ${when}` : ""}. Clear it there to follow the club's automatic meet again.`,
    };
  }
  if (input.discovered) {
    return {
      url: input.discovered,
      how: "Taken from the club live-results page. That address is replaced when a new meet is published, so nothing needs changing before the gala.",
    };
  }
  if (input.fallback) {
    return {
      url: input.fallback,
      how: "Using RESULTS_INDEX_URL because the club page did not list a results link.",
    };
  }
  return {
    url: FALLBACK_RESULTS_INDEX,
    how: "The club page did not include a results link, so the usual Warriors results address is used. That address is replaced when a new meet is published.",
  };
}

/** Saved Settings link, then the club page, then RESULTS_INDEX_URL. */
export async function resolveResultsIndex(input: {
  saved: { url: string; savedAt: string } | null;
  fallback: string | null;
}): Promise<ResultsSource> {
  if (input.saved) return chooseResultsSource({ saved: input.saved, discovered: null, fallback: input.fallback });
  const page = await fetchText(CLUB_RESULTS_PAGE);
  const found = page.ok ? findResultsIndex(page.text) : null;
  const discovered = found ? new URL(found, CLUB_RESULTS_PAGE).toString() : null;
  return chooseResultsSource({ saved: null, discovered, fallback: input.fallback });
}

function formatSaved(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}
