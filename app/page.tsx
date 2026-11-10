import { Gate } from "@/components/Gate";
import { Shell } from "@/components/Shell";
import { Dashboard } from "@/components/Dashboard";
import { isAuthed } from "@/app/actions";
import { getConfig } from "@/lib/config";
import { loadDashboard } from "@/lib/load-swim-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const config = getConfig();
  if (!config.passcode) return <Gate configured={false} next="/" />;
  if (!(await isAuthed())) return <Gate configured error={params.error === "1"} next="/" />;
  const model = await loadDashboard();
  return (
    <Shell active="swims">
      <Dashboard model={model} />
    </Shell>
  );
}
