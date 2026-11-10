import { clearResultsLink, saveResultsLink } from "@/app/actions";

export function SettingsPanel({
  activeUrl,
  how,
  savedAt,
  storeReady,
  error,
  notice,
  attempt,
}: {
  activeUrl: string;
  how: string;
  savedAt: string | null;
  storeReady: boolean;
  error: string | null;
  notice: string | null;
  attempt: string;
}) {
  const when = savedAt ? formatWhen(savedAt) : "";

  return (
    <>
      <section className="intro">
        <h1>Settings</h1>
        <p>Paste a SportSystems meet link if the club publishes results somewhere other than the usual page.</p>
      </section>

      <section className="meetbox">
        <p className="section-title">Active results link</p>
        <p className="link-break"><a href={activeUrl}>{activeUrl}</a></p>
        {when ? <p className="fetched-strong">Saved {when}</p> : <p className="fetched-strong">Automatic. Nothing is saved in Settings.</p>}
        <p className="detail">{how}</p>
      </section>

      {error ? <p className="notice">{error}</p> : null}
      {notice ? <p className="detail">{notice}</p> : null}

      <form className="settings" action={saveResultsLink}>
        <label htmlFor="url">SportSystems results link</label>
        <input
          id="url"
          name="url"
          type="url"
          inputMode="url"
          required
          placeholder="https://…/index.htm"
          defaultValue={attempt}
        />
        <button type="submit">Save</button>
        {storeReady ? null : (
          <p className="detail">
            Saving needs an Upstash Redis database connected to this Vercel project. Until then the app keeps using the automatic link. The one-time setup is in the README.
          </p>
        )}
      </form>

      <form action={clearResultsLink}>
        <button className="secondary" type="submit" disabled={!savedAt}>Clear and go back to automatic</button>
      </form>
    </>
  );
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}
