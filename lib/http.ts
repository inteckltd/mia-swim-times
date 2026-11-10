export interface FetchResult {
  ok: boolean;
  status: number;
  url: string;
  text: string;
  error?: string;
}

const USER_AGENT = "MiaSwimTimes/1.0 (private family results viewer; responses are cached)";

export async function fetchText(url: string, timeoutMs = 20000): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, url: response.url, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The request failed.";
    return { ok: false, status: 0, url, text: "", error: message };
  }
}

export function isChallenge(result: FetchResult): boolean {
  if (result.status === 403 || result.status === 429 || result.status === 503) return true;
  return /just a moment|cf-challenge|cdn-cgi\/challenge/i.test(result.text);
}
