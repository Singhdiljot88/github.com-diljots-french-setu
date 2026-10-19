"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Bi } from "./bi";
import { SECTION_ORDER, TEF_CANADA, type SectionKey } from "@/content/tef-config";

export function ExamStart({ mocks }: { mocks: { id: string; title: string }[] }) {
  const router = useRouter();
  const [mockId, setMockId] = useState(mocks[0]?.id ?? "");
  const [sections, setSections] = useState<SectionKey[]>([...SECTION_ORDER]);
  const [strict, setStrict] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (k: SectionKey) => setSections((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const minutes = sections.reduce((a, k) => a + TEF_CANADA.sections[k].minutes, 0);
  const go = async () => {
    setBusy(true); setError(null);
    try { const r = await api<{ id: string }>("/api/exam", { body: { mockId, sections, strict } }); router.push(`/exam/${r.id}`); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  };
  return (
    <section className="card space-y-3">
      <h2 className="font-semibold"><Bi as="span" t={{ en: "Start a practice exam", hi: "अभ्यास परीक्षा शुरू करें" }} /></h2>
      <label className="block text-sm font-medium"><Bi as="span" t={{ en: "Exam", hi: "परीक्षा" }} />
        <select className="input mt-1" value={mockId} onChange={(e) => setMockId(e.target.value)}>{mocks.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select>
      </label>
      <fieldset>
        <legend className="text-sm font-medium"><Bi as="span" t={{ en: "Sections", hi: "खंड" }} /></legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {SECTION_ORDER.map((k) => <label key={k} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={sections.includes(k)} onChange={() => toggle(k)} /> <Bi as="span" t={{ en: `${TEF_CANADA.sections[k].en} (${TEF_CANADA.sections[k].minutes} min)`, hi: `${TEF_CANADA.sections[k].hi} (${TEF_CANADA.sections[k].minutes} मिनट)` }} /></label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium"><Bi as="span" t={{ en: "Rules", hi: "नियम" }} /></legend>
        <label className="mt-1 flex items-start gap-2 text-sm"><input type="radio" name="strict" checked={strict} onChange={() => setStrict(true)} className="mt-1" /> <Bi as="span" t={{ en: "Exam rules. Server clocks that keep running if you close the page, automatic submission when time is up, each recording played once, no going back in listening.", hi: "परीक्षा के नियम। पेज बंद करने पर भी घड़ी चलती रहती है, समय पूरा होने पर उत्तर अपने आप जमा हो जाते हैं, हर रिकॉर्डिंग एक ही बार चलती है, और सुनने वाले खंड में पीछे नहीं जा सकते।" }} /></label>
        <label className="mt-1 flex items-start gap-2 text-sm"><input type="radio" name="strict" checked={!strict} onChange={() => setStrict(false)} className="mt-1" /> <Bi as="span" t={{ en: "Relaxed. Clocks are shown as a guide. Replays and going back are allowed.", hi: "ढील वाले नियम। घड़ी केवल अंदाज़े के लिए दिखती है। रिकॉर्डिंग दोबारा सुनना और पीछे जाना मना नहीं है।" }} /></label>
      </fieldset>
      <Bi className="text-sm text-muted" t={{ en: `About ${minutes} minutes in total. You take one section at a time and can stop between sections.`, hi: `कुल लगभग ${minutes} मिनट। आप एक बार में एक खंड करते हैं और खंडों के बीच रुक सकते हैं।` }} />
      <button type="button" className="btn btn-primary" disabled={busy || !sections.length || !mockId} onClick={go}><Bi as="span" t={busy ? { en: "Starting…", hi: "शुरू हो रहा है…" } : { en: "Start", hi: "शुरू करें" }} /></button>
      {error && <p role="alert" className="text-sm">{error}</p>}
    </section>
  );
}
