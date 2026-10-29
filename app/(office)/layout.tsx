import Link from "next/link";
import { db, hasDb } from "@/lib/db";
import { Nav } from "@/components/Nav";
import { Mark } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { logout } from "@/app/login/actions";

export const dynamic = "force-dynamic";

function SetupNeeded() {
  return (
    <main className="page page--narrow">
      <div className="card stack-4">
        <h1 className="tn-title">Connect the database</h1>
        <p>Tensor needs the Supabase secret key to read and write project data.</p>
        <ol className="stack-2" style={{ paddingLeft: 20, margin: 0 }}>
          <li>Open Supabase → project <span className="tn-data">tensor</span> → Project Settings → API Keys.</li>
          <li>Copy the secret key into <span className="tn-data">.env.local</span> as <span className="tn-data">SUPABASE_SECRET_KEY</span>.</li>
          <li>Restart the app.</li>
        </ol>
      </div>
    </main>
  );
}

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const ready = hasDb();
  let pending = 0;
  if (ready) {
    const { count } = await db().from("updates").select("id", { count: "exact", head: true }).eq("status", "pending");
    pending = count ?? 0;
  }
  return (
    <>
      <header className="shell-top">
        <div className="shell-top__inner">
          <Link href="/" className="brand">
            <Mark />
            <span>Tensor</span>
          </Link>
          <Nav pending={pending} variant="top" />
          <div className="shell-right">
            <span className="demo-flag" title="Prototype with demo data">Demo</span>
            <form action={logout}>
              <button className="tn-btn tn-btn--quiet" aria-label="Sign out">
                <Icon name="logout" />
              </button>
            </form>
          </div>
        </div>
      </header>
      {ready ? children : <SetupNeeded />}
      <Nav pending={pending} variant="bottom" />
    </>
  );
}
