export interface SavedResultsLink {
  url: string;
  savedAt: string;
}

const KEY = "mia:results-index";

interface StoreEnv {
  url: string;
  token: string;
}

/** Upstash Redis REST, including the env names the older Vercel KV integration set. */
export function resultsStoreEnv(): StoreEnv | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "").trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

export function resultsStoreConfigured(): boolean {
  return resultsStoreEnv() !== null;
}

async function command<T>(args: string[]): Promise<T> {
  const env = resultsStoreEnv();
  if (!env) throw new Error("The results store is not connected.");
  const response = await fetch(env.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  let payload: { result?: T; error?: string };
  try {
    payload = (await response.json()) as { result?: T; error?: string };
  } catch {
    throw new Error(`The results store returned ${response.status}.`);
  }
  if (!response.ok || payload.error) {
    throw new Error(payload.error || `The results store returned ${response.status}.`);
  }
  return payload.result as T;
}

export async function readSavedResults(): Promise<SavedResultsLink | null> {
  if (!resultsStoreConfigured()) return null;
  const raw = await command<string | null>(["GET", KEY]);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedResultsLink>;
    if (!parsed.url || !parsed.savedAt) return null;
    return { url: parsed.url, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export async function writeSavedResults(link: SavedResultsLink): Promise<void> {
  await command(["SET", KEY, JSON.stringify(link)]);
}

export async function clearSavedResults(): Promise<void> {
  await command(["DEL", KEY]);
}
