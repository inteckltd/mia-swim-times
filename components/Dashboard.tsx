import { standardsNotes } from "@/lib/standards";
import type { DashboardModel, EventCard } from "@/lib/types";
import { countyWindow, regionalWindow } from "@/lib/windows";

export function Dashboard({ model }: { model: DashboardModel }) {
  const when = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(model.fetchedAt));

  return (
    <>
      <section className="intro">
        <h1>{model.swimmerName}</h1>
        <p className="meta">{model.club} · SE {model.membership}</p>
        <p className="age">{model.ageLine}</p>
      </section>

      <section className="meetbox">
        <p className="section-title">Meet loaded</p>
        <h2>{model.meetName ?? "No meet published"}</h2>
        <p className="course">{model.meetCourseLabel}</p>
        <p className="fetched-strong">Results last fetched {when}</p>
        <p className="detail">{model.resultsHow}</p>
        <p className="detail">Races appear as the club posts each event. A race that is not listed yet has not been published.</p>
        {model.resultsUrl ? (
          <p className="sources">
            <a href={model.resultsUrl}>Open the results index</a>
            <a href="/settings">Change this link</a>
          </p>
        ) : null}
      </section>

      {model.warnings.map((warning) => (
        <p className="notice" key={warning}>{warning}</p>
      ))}
      {model.notes.map((note) => (
        <p className="detail" key={note}>{note}</p>
      ))}

      <section className="stack">
        <p className="window">{countyWindow().summary}</p>
        <p className="window">{regionalWindow().summary}</p>
      </section>

      <h2 className="section-title">Mia at this meet</h2>
      {model.galaCards.length === 0 ? (
        <p className="empty">No swims for Mia are on the published pages yet.</p>
      ) : (
        <div className="cards">
          {model.galaCards.map((card) => (
            <Card key={card.id} card={card} />
          ))}
        </div>
      )}

      {model.otherCards.length > 0 ? (
        <>
          <h2 className="section-title">Other personal bests</h2>
          <div className="cards">
            {model.otherCards.map((card) => (
              <Card key={card.id} card={card} />
            ))}
          </div>
        </>
      ) : null}

      <details>
        <summary>Where the standards come from</summary>
        <ul className="rules">
          {standardsNotes().map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </details>

      <p className="sources">
        {model.sources.map((source) => (
          <a key={source.href} href={source.href}>{source.label}</a>
        ))}
      </p>
      <p className="fetched">Results last fetched {when}. Opening the app checks again about every two minutes. Refresh fetches immediately.</p>
    </>
  );
}

function Card({ card }: { card: EventCard }) {
  return (
    <article className={`card tone-${card.tone}`}>
      <h2>{card.title}</h2>
      {card.meta ? <p className="meta">{card.meta}</p> : null}
      {card.headline ? <p className="time">{card.headline}</p> : null}
      {card.courseLabel ? <p className="course">{card.courseLabel}</p> : null}
      {card.pbLine ? <p>{card.pbLine}</p> : null}
      {card.entry ? <p>{card.entry}</p> : null}
      <p className="pbs">
        <span>Short course {card.shortPb}</span>
        <span>Long course {card.longPb}</span>
      </p>
      <p className="summary">{card.summary}</p>
      {card.detail ? <p className="detail">{card.detail}</p> : null}
      {card.windowLine ? <p className="window">{card.windowLine}</p> : null}
    </article>
  );
}
