import type { RankingsModel } from "@/lib/types";

export function Rankings({ model }: { model: RankingsModel }) {
  return (
    <>
      <section className="intro">
        <h1>Rankings</h1>
        <p className="meta">{model.swimmerName} · {model.club}</p>
        <p className="age">{model.ageLine}</p>
        <p className="season">{model.seasonNote}</p>
      </section>

      {model.blocked ? (
        <p className="notice"><strong>Rankings were blocked</strong>{model.blocked}</p>
      ) : null}
      {model.warnings.map((warning) => (
        <p className="notice" key={warning}>{warning}</p>
      ))}

      <section className="stack">
        {model.windowNotes.map((note) => (
          <p className="window" key={note}>{note}</p>
        ))}
      </section>

      {model.events.length === 0 && !model.blocked ? (
        <p className="empty">No ranked events were available for this age group.</p>
      ) : null}

      <div className="cards">
        {model.events.map((event) => (
          <article className="rank-event" key={event.title}>
            <h2>{event.title}</h2>
            {event.courses.map((course) => (
              <section className="rank-course" key={course.courseLabel}>
                <h3>{course.courseLabel}</h3>
                {course.cells.map((cell) => (
                  <div className="rank-row" key={cell.level}>
                    <p className="rank-label">
                      {cell.href ? <a href={cell.href}>{cell.label}</a> : cell.label}
                    </p>
                    <p className="rank-place">{cell.rankLabel ?? "—"}</p>
                    {cell.timeLabel ? (
                      <p className="rank-note">{cell.timeLabel}{cell.dateLabel ? ` · ${cell.dateLabel}` : ""}</p>
                    ) : null}
                    {cell.meet ? <p className="rank-meet">{cell.meet}</p> : null}
                    {cell.windowLine ? <p className="rank-window">{cell.windowLine}</p> : null}
                    {cell.note ? <p className="rank-note">{cell.note}</p> : null}
                  </div>
                ))}
              </section>
            ))}
          </article>
        ))}
      </div>
      <p className="fetched">Rankings are cached for about an hour. Refresh loads them again. A missing place means she was not on the pages read.</p>
    </>
  );
}
