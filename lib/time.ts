/** Swim time stored as hundredths of a second so 35.89 does not become 35.889999. */
export type Centiseconds = number;

export function parseSwimTime(raw: string | null | undefined): Centiseconds | null {
  if (raw == null) return null;
  const cleaned = raw
    .replace(/\u0000/g, "")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\.+/g, ".")
    .replace(/:+/g, ":");
  if (!cleaned || cleaned === "." || cleaned === "-" || /[a-z]/i.test(cleaned)) return null;

  const clock = cleaned.match(/^(\d+):(\d{1,2})\.(\d{1,2})$/);
  if (clock) return fromParts(Number(clock[1]), Number(clock[2]), clock[3]);

  const dotted = cleaned.match(/^(\d+)\.(\d{2})\.(\d{1,2})$/);
  if (dotted) return fromParts(Number(dotted[1]), Number(dotted[2]), dotted[3]);

  const seconds = cleaned.match(/^(\d+)\.(\d{1,2})$/);
  if (seconds) return fromParts(0, Number(seconds[1]), seconds[2]);

  return null;
}

function fromParts(minutes: number, seconds: number, hundredthsRaw: string): Centiseconds | null {
  if (seconds >= 60 || !/^\d{1,2}$/.test(hundredthsRaw)) return null;
  const fraction = hundredthsRaw.length === 1 ? Number(hundredthsRaw) * 10 : Number(hundredthsRaw);
  if (fraction >= 100) return null;
  return minutes * 6000 + seconds * 100 + fraction;
}

export function formatSwimTime(cs: Centiseconds): string {
  const sign = cs < 0 ? "-" : "";
  let rest = Math.abs(Math.round(cs));
  const hundredths = rest % 100;
  rest = Math.floor(rest / 100);
  const seconds = rest % 60;
  const minutes = Math.floor(rest / 60);
  const hh = hundredths.toString().padStart(2, "0");
  if (minutes > 0) {
    return `${sign}${minutes}:${seconds.toString().padStart(2, "0")}.${hh}`;
  }
  return `${sign}${seconds}.${hh}`;
}

/** Gap under a minute stays in seconds (0.85s). Longer gaps use swim time format. */
export function formatGap(cs: Centiseconds): string {
  const abs = Math.abs(Math.round(cs));
  if (abs >= 6000) return formatSwimTime(abs);
  return `${(abs / 100).toFixed(2)}s`;
}

export function formatSignedGap(delta: Centiseconds): string {
  if (delta === 0) return "0.00s";
  const sign = delta < 0 ? "−" : "+";
  return `${sign}${formatGap(delta)}`;
}
