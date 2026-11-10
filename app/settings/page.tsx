import { Gate } from "@/components/Gate";
import { SettingsPanel } from "@/components/SettingsPanel";
import { Shell } from "@/components/Shell";
import { isAuthed } from "@/app/actions";
import { getConfig } from "@/lib/config";
import { resolveResultsIndex } from "@/lib/meet-source";
import { readSavedResults, resultsStoreConfigured } from "@/lib/results-store";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; cleared?: string; url?: string }>;
}) {
  const params = await searchParams;
  const config = getConfig();
  if (!config.passcode) return <Gate configured={false} next="/settings" />;
  if (!(await isAuthed())) return <Gate configured error={params.error === "1"} next="/settings" />;

  let saved = null;
  let storeWarning: string | null = null;
  try {
    saved = await readSavedResults();
  } catch (error) {
    storeWarning = error instanceof Error ? error.message : "The saved link could not be read.";
  }
  const source = await resolveResultsIndex({ saved, fallback: config.resultsIndexUrl });
  const notice = params.saved
    ? "Saved. Swims now read this link, and the previous results were dropped from the cache."
    : params.cleared
      ? "Cleared. Swims follow the automatic meet again."
      : null;

  return (
    <Shell active="settings">
      <SettingsPanel
        activeUrl={source.url}
        how={source.how}
        savedAt={saved?.savedAt ?? null}
        storeReady={resultsStoreConfigured() && !storeWarning}
        error={params.error || storeWarning}
        notice={notice}
        attempt={params.url ?? ""}
      />
    </Shell>
  );
}
