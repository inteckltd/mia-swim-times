import Link from "next/link";
import { logout, refreshData } from "@/app/actions";

export function Shell({ active, children }: { active: "swims" | "rankings"; children: React.ReactNode }) {
  const next = active === "rankings" ? "/rankings" : "/";
  return (
    <>
      <header className="top">
        <div>
          <p className="eyebrow">Mia Clarke</p>
          <p className="brand-sub">Swim times</p>
        </div>
        <form action={refreshData}>
          <input type="hidden" name="next" value={next} />
          <button type="submit">Refresh</button>
        </form>
      </header>
      <nav className="tabs" aria-label="Sections">
        <Link href="/" aria-current={active === "swims" ? "page" : undefined}>Swims</Link>
        <Link href="/rankings" aria-current={active === "rankings" ? "page" : undefined}>Rankings</Link>
      </nav>
      <main>
        {children}
        <form className="logout" action={logout}>
          <button type="submit">Lock</button>
        </form>
      </main>
    </>
  );
}
