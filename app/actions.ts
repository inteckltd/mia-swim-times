"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config";
import { clearSavedResults, resultsStoreConfigured, writeSavedResults } from "@/lib/results-store";
import { validateResultsLink } from "@/lib/validate-results";

const COOKIE = "mia_gate";

export async function isAuthed(): Promise<boolean> {
  const passcode = getConfig().passcode;
  if (!passcode) return false;
  const jar = await cookies();
  return jar.get(COOKIE)?.value === passcode;
}

export async function login(formData: FormData) {
  const passcode = getConfig().passcode;
  const next = safePath(formData.get("next"));
  if (!passcode) redirect(next);
  if (String(formData.get("passcode") ?? "") !== passcode) {
    redirect(`${next}${next.includes("?") ? "&" : "?"}error=1`);
  }
  const jar = await cookies();
  jar.set(COOKIE, passcode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(next);
}

export async function logout() {
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect("/");
}

export async function saveResultsLink(formData: FormData) {
  if (!(await isAuthed())) redirect("/");
  const raw = String(formData.get("url") ?? "");
  const checked = await validateResultsLink(raw);
  const attempt = (checked.ok ? checked.url : raw.trim()).slice(0, 500);
  if (!checked.ok) redirect(settingsQuery({ error: checked.error, url: attempt }));
  if (!resultsStoreConfigured()) {
    redirect(settingsQuery({
      error: "The results store is not connected. Connect Upstash Redis on Vercel, redeploy, then save the link again.",
      url: checked.url,
    }));
  }
  try {
    await writeSavedResults({ url: checked.url, savedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The link could not be saved.";
    redirect(settingsQuery({ error: message, url: checked.url }));
  }
  updateTag("swim-data");
  await markFresh();
  redirect("/settings?saved=1");
}

export async function clearResultsLink() {
  if (!(await isAuthed())) redirect("/");
  if (!resultsStoreConfigured()) {
    redirect(settingsQuery({ error: "The results store is not connected, so there is no saved link to clear." }));
  }
  try {
    await clearSavedResults();
  } catch (error) {
    const message = error instanceof Error ? error.message : "The saved link could not be cleared.";
    redirect(settingsQuery({ error: message }));
  }
  updateTag("swim-data");
  await markFresh();
  redirect("/settings?cleared=1");
}

export async function refreshData(formData: FormData) {
  if (!(await isAuthed())) redirect("/");
  await markFresh();
  updateTag("swim-data");
  updateTag("rankings-data");
  redirect(safePath(formData.get("next")));
}

async function markFresh() {
  const jar = await cookies();
  jar.set("mia_fresh", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 120,
  });
}

function settingsQuery(input: { error: string; url?: string }): string {
  const params = new URLSearchParams({ error: input.error });
  if (input.url) params.set("url", input.url);
  return `/settings?${params.toString()}`;
}

function safePath(value: FormDataEntryValue | null): string {
  const path = String(value ?? "/");
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}
