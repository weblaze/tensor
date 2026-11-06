import Link from "next/link";
import { MANAGERS, requirePage } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import { Wizard } from "./Wizard";

export const metadata = { title: "Set up a template" };

export default async function NewTemplatePage({ searchParams }: { searchParams: Promise<{ tutorial?: string; name?: string }> }) {
  await requirePage(...MANAGERS);
  const { tutorial, name } = await searchParams;
  return (
    <main className="page page--narrow" style={{ maxWidth: 960 }}>
      <Link href="/settings/templates" className="tn-btn tn-btn--quiet" style={{ marginLeft: -16, marginBottom: 8 }}><Icon name="back" />Templates</Link>
      <Wizard tutorial={tutorial !== "0"} initialName={(name ?? "").slice(0, 120)} />
    </main>
  );
}
