"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Bi, useBiLabel } from "./bi";

/** "Report a problem" link that logs a content report against `target` (e.g. day:12, dict:manger|verb). */
export function ReportProblem({ target }: { target: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const L = useBiLabel();
  return (
    <span>
      <button type="button" className="underline" onClick={() => setOpen((o) => !o)} aria-expanded={open}><Bi as="span" t={{ en: "Report a problem", hi: "समस्या बताएँ" }} /></button>
      {open && state !== "sent" && (
        <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); try { await api("/api/content-report", { body: { ref: target, message: msg } }); setState("sent"); } catch { setState("error"); } }}>
          <input className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={L({ en: "What looks wrong? (e.g. a translation or accent)", hi: "क्या ग़लत लग रहा है? (जैसे कोई अनुवाद या एक्सेंट चिह्न)" })} maxLength={1000} required aria-label={L({ en: "Describe the problem", hi: "समस्या के बारे में बताएँ" })} />
          <button className="btn btn-secondary btn-sm"><Bi as="span" t={{ en: "Send", hi: "भेजें" }} /></button>
        </form>
      )}
      {state === "error" && <span role="alert" className="ml-2"><Bi as="span" t={{ en: "Could not send. Try again.", hi: "भेजा नहीं जा सका। फिर से कोशिश करें।" }} /></span>}
      {state === "sent" && <Bi as="span" className="ml-2" t={{ en: "Thanks, logged against this content version.", hi: "धन्यवाद, इसे सामग्री के इस संस्करण के साथ दर्ज कर लिया गया है।" }} />}
    </span>
  );
}
