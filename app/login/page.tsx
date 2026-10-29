import type { Metadata } from "next";
import { Mark } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="login">
      <div className="card login__card">
        <div className="brand">
          <Mark size={28} />
          <span>Tensor</span>
        </div>
        <div className="stack-2">
          <h1 className="tn-title">Design Matrix office</h1>
          <p className="tn-muted">Sites, orders and updates in one place.</p>
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
