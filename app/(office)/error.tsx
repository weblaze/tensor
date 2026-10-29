"use client";
import { Icon } from "@/components/Icon";

export default function OfficeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page page--narrow">
      <div className="card stack-4">
        <div className="flash flash--error" style={{ margin: 0 }}>
          <Icon name="alert" />
          <span>Something went wrong loading this screen.</span>
        </div>
        <p className="tn-muted">
          Usually the database could not be reached. Check the connection and try again.
          {error.digest ? <> Reference <span className="tn-data">{error.digest}</span>.</> : null}
        </p>
        <div><button className="tn-btn" onClick={reset}><Icon name="refresh" />Try again</button></div>
      </div>
    </main>
  );
}
