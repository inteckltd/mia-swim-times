"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config";

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

export async function refreshData(formData: FormData) {
  if (!(await isAuthed())) redirect("/");
  updateTag("swim-data");
  updateTag("rankings-data");
  redirect(safePath(formData.get("next")));
}

function safePath(value: FormDataEntryValue | null): string {
  const path = String(value ?? "/");
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}
