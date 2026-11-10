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

      {model.warnings.map((warning) => (
        <p className="notice" key={warning}>{warning}</p>
      ))}

      <section className="stack">
        <p className="window">{countyWindow().summary}</p>
        <p className="window">{regionalWindow().summary}</p>
      </section>

      <h2 className="section-title">{model.meetName ?? "Latest gala"} · {model.meetCourseLabel}</h2>
      {model.galaCards.length === 0 ? (
        <p className="empty">No swims for Mia were on the published results pages.</p>
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
      <p className="fetched">Loaded {when}. Refresh checks the sites again.</p>
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
