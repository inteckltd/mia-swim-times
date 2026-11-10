import { Gate } from "@/components/Gate";
import { Rankings } from "@/components/Rankings";
import { Shell } from "@/components/Shell";
import { isAuthed } from "@/app/actions";
import { getConfig } from "@/lib/config";
import { loadRankings } from "@/lib/load-rankings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function RankingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const config = getConfig();
  if (!config.passcode) return <Gate configured={false} next="/rankings" />;
  if (!(await isAuthed())) return <Gate configured error={params.error === "1"} next="/rankings" />;
  const model = await loadRankings();
  return (
    <Shell active="rankings">
      <Rankings model={model} />
    </Shell>
  );
}
