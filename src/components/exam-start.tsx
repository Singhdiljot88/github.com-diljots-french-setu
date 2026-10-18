"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
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
      <h2 className="font-semibold">Start a practice exam</h2>
      <label className="block text-sm font-medium">Exam
        <select className="input mt-1" value={mockId} onChange={(e) => setMockId(e.target.value)}>{mocks.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select>
      </label>
      <fieldset>
        <legend className="text-sm font-medium">Sections</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {SECTION_ORDER.map((k) => <label key={k} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={sections.includes(k)} onChange={() => toggle(k)} /> {TEF_CANADA.sections[k].en} ({TEF_CANADA.sections[k].minutes} min)</label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">Rules</legend>
        <label className="mt-1 flex items-start gap-2 text-sm"><input type="radio" name="strict" checked={strict} onChange={() => setStrict(true)} className="mt-1" /> <span><strong>Exam rules.</strong> Server clocks that keep running if you close the page, automatic submission when time is up, each recording played once, no going back in listening.</span></label>
        <label className="mt-1 flex items-start gap-2 text-sm"><input type="radio" name="strict" checked={!strict} onChange={() => setStrict(false)} className="mt-1" /> <span><strong>Relaxed.</strong> Clocks are shown as a guide. Replays and going back are allowed.</span></label>
      </fieldset>
      <p className="text-sm text-muted">About {minutes} minutes in total. You take one section at a time and can stop between sections.</p>
      <button type="button" className="btn btn-primary" disabled={busy || !sections.length || !mockId} onClick={go}>{busy ? "Starting…" : "Start"}</button>
      {error && <p role="alert" className="text-sm">{error}</p>}
    </section>
  );
}
