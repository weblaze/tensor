import Link from "next/link";
import { db, hasDb } from "@/lib/db";
import { demoMode } from "@/lib/config";
import { Nav, type NavItem } from "@/components/Nav";
import { canManage, getViewer } from "@/lib/auth";
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

const ROLE_WORD: Record<string, string> = {
  admin: "Office login", coordinator: "Coordinator", head: "Head", procurement: "Procurement", supervisor: "Supervisor", doctor: "Doctor",
};

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const ready = hasDb();
  const viewer = ready ? await getViewer() : null;
  const manage = canManage(viewer);
  let pending = 0;
  if (ready && manage) {
    const { count } = await db().from("updates").select("id", { count: "exact", head: true }).eq("status", "pending");
    pending = count ?? 0;
  }
  const items: NavItem[] = manage
    ? [
        { href: "/", label: "Today", icon: "home" },
        { href: "/inbox", label: "Inbox", icon: "inbox", count: pending },
        { href: "/projects", label: "Projects", icon: "folder" },
        { href: "/people", label: "People", icon: "users" },
        { href: "/settings", label: "Settings", icon: "settings" },
      ]
    : [{ href: "/me", label: viewer?.role === "doctor" ? "My clinic" : viewer?.role === "procurement" ? "My orders" : "My sites", icon: "home" }];
  return (
    <>
      <header className="shell-top">
        <div className="shell-top__inner">
          <Link href={manage ? "/" : "/me"} className="brand">
            <Mark />
            <span>Tensor</span>
          </Link>
          <Nav items={items} variant="top" />
          <div className="shell-right">
            {demoMode() ? <span className="demo-flag" title="Demo deployment with sample data">Demo</span> : null}
            {viewer ? (
              <Link href="/me" className="tn-btn tn-btn--quiet hide-sm" title="Your account">
                {viewer.name}
                <span className="tn-caption">· {ROLE_WORD[viewer.role]}</span>
              </Link>
            ) : null}
            <form action={logout}>
              <button className="tn-btn tn-btn--quiet" aria-label="Sign out">
                <Icon name="logout" />
              </button>
            </form>
          </div>
        </div>
      </header>
      {ready ? children : <SetupNeeded />}
      {items.length > 1 ? <Nav items={items} variant="bottom" /> : null}
    </>
  );
}
