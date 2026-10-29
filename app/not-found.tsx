import Link from "next/link";
import { Mark } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="login">
      <div className="card login__card">
        <div className="brand"><Mark size={28} /><span>Tensor</span></div>
        <div className="stack-2">
          <h1 className="tn-title">Page not found</h1>
          <p className="tn-muted">This link is wrong or no longer works. If it was a site report link, ask your Design Matrix coordinator for a new one.</p>
        </div>
        <Link href="/" className="tn-btn">Go to Tensor</Link>
      </div>
    </main>
  );
}
