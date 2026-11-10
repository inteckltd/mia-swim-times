import { login } from "@/app/actions";

export function Gate({ configured, error, next }: { configured: boolean; error?: boolean; next: string }) {
  return (
    <main>
      <form className="gate" action={login}>
        <p className="eyebrow" style={{ color: "var(--teal-deep)" }}>Mia Clarke</p>
        <h1>Swim times</h1>
        {configured ? (
          <>
            <p>Enter the family passcode to see Mia’s times, qualifying gaps and rankings.</p>
            {error ? <p className="notice">That passcode did not match.</p> : null}
            <input type="hidden" name="next" value={next} />
            <label htmlFor="passcode">Passcode</label>
            <input id="passcode" name="passcode" type="password" autoComplete="current-password" required />
            <button type="submit">Continue</button>
          </>
        ) : (
          <p>Set APP_PASSCODE in the environment before opening this app. Times stay hidden until that is set.</p>
        )}
      </form>
    </main>
  );
}
