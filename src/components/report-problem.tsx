"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";

/** "Report a problem" link that logs a content report against `target` (e.g. day:12, dict:manger|verb). */
export function ReportProblem({ target }: { target: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  return (
    <span>
      <button type="button" className="underline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Report a problem</button>
      {open && state !== "sent" && (
        <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); try { await api("/api/content-report", { body: { ref: target, message: msg } }); setState("sent"); } catch { setState("error"); } }}>
          <input className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="What looks wrong? (e.g. a translation or accent)" maxLength={1000} required aria-label="Describe the problem" />
          <button className="btn btn-secondary btn-sm">Send</button>
        </form>
      )}
      {state === "error" && <span role="alert" className="ml-2">Could not send. Try again.</span>}
      {state === "sent" && <span className="ml-2">Thanks, logged against this content version.</span>}
    </span>
  );
}
