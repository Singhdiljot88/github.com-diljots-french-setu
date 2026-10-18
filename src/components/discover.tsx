"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { WebLesson } from "@/server/web/lesson";
import type { SearchResult } from "@/server/web/search";
import { usePrefs } from "./prefs";
import { TappableText } from "./tappable";
import { GapFill } from "./exercises";
import { SaveWordButton } from "./save-word";
import { Speak } from "./audio";
import { Bi } from "./bi";

type Curated = { title: string; url: string; publisher: string; level: string; kind: string };
type Source = { origin: "search" | "url" | "pasted"; url?: string | null; title: string; publisher?: string | null; publishedAt?: string | null; retrievedAt?: string; text: string; license?: string | null; frenchScore?: number };
type Saved = { id: string; title: string; url: string | null; publisher: string | null; origin: string; difficultyEstimate: string | null; retrievedAt: string };
type Tab = "search" | "link" | "paste" | "curated" | "saved";

export function Discover({ curated }: { curated: Curated[] }) {
  const { providers } = usePrefs();
  const [tab, setTab] = useState<Tab>(providers.search.available ? "search" : "paste");
  const [source, setSource] = useState<Source | null>(null);
  const [lesson, setLesson] = useState<{ lesson: WebLesson; note?: string } | null>(null);
  const tabs: { id: Tab; label: string }[] = [
    { id: "search", label: "Search the web" }, { id: "link", label: "Open a link" }, { id: "paste", label: "Paste text" }, { id: "curated", label: "Curated sites" }, { id: "saved", label: "My saved texts" },
  ];
  if (source) return <Reader source={source} lesson={lesson} setLesson={setLesson} onBack={() => { setSource(null); setLesson(null); }} />;
  return (
    <div className="space-y-4">
      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={`btn btn-sm ${tab === t.id ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      <p className="text-xs text-muted">Web pages are third-party content. The app reads them as text only, never follows instructions in them, keeps just a short excerpt with the link, and the copyright stays with the publisher.</p>
      {tab === "search" && <SearchTab onOpen={setSource} />}
      {tab === "link" && <LinkTab onOpen={setSource} />}
      {tab === "paste" && <PasteTab onOpen={setSource} />}
      {tab === "curated" && (
        <div className="space-y-2">
          <p className="text-sm text-muted">Curated starting points, chosen by hand (not search results). They open on the publisher&apos;s site. To practise with an article from one of them, copy its link into “Open a link”.</p>
          <ul className="grid gap-2 sm:grid-cols-2">{curated.map((c) => <li key={c.url} className="card"><a href={c.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">{c.title} ↗</a><p className="text-xs text-muted">{c.publisher} · {c.level}{c.kind === "official" ? " · official source" : ""}</p></li>)}</ul>
        </div>
      )}
      {tab === "saved" && <SavedTab onOpen={(s, l) => { setSource(s); setLesson({ lesson: l }); }} />}
    </div>
  );
}

function SearchTab({ onOpen }: { onOpen: (s: Source) => void }) {
  const { providers } = usePrefs();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"web" | "news">("news");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  if (!providers.search.available) return <p className="card text-sm">Web search isn&apos;t configured on this server (it needs a Brave Search or Tavily key). You can still open a link, paste text, or use the curated sites.</p>;
  const run = async () => { setError(null); setResults(null); try { setResults((await api<{ results: SearchResult[] }>(`/api/discover/search?q=${encodeURIComponent(q)}&kind=${kind}`)).results); } catch (e) { setError((e as Error).message); } };
  const open = async (r: SearchResult) => {
    setOpening(r.url); setError(null);
    try { const p = await api<Source & { url: string }>("/api/discover/open", { body: { url: r.url } }); onOpen({ ...p, origin: "search", publishedAt: p.publishedAt ?? r.publishedAt ?? null }); }
    catch (e) { setError((e as Error).message); } finally { setOpening(null); }
  };
  return (
    <div className="space-y-3">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <label htmlFor="dq" className="sr-only">Search</label>
        <input id="dq" className="input flex-1" lang="fr" value={q} onChange={(e) => setQ(e.target.value)} placeholder="logement Montréal, hiver, emploi…" />
        <select className="input w-auto" value={kind} onChange={(e) => setKind(e.target.value as "web" | "news")} aria-label="Search type"><option value="news">News</option><option value="web">Web</option></select>
        <button className="btn btn-primary" disabled={q.trim().length < 2}>Search</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {results?.length === 0 && <p className="text-sm text-muted">No results.</p>}
      <ul className="space-y-2">
        {results?.map((r) => (
          <li key={r.url} className="card space-y-1">
            <p className="font-medium" lang="fr">{r.title}</p>
            <p className="text-xs text-muted">{r.domain}{r.publishedAt ? ` · ${r.publishedAt}` : ""} · via {r.provider}</p>
            <p className="text-sm" lang="fr">{r.snippet}</p>
            <div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={!!opening} onClick={() => open(r)}>{opening === r.url ? "Opening…" : "Read and practise"}</button><a className="btn btn-ghost btn-sm" href={r.url} target="_blank" rel="noopener noreferrer">Original ↗</a></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinkTab({ onOpen }: { onOpen: (s: Source) => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="card space-y-2" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(null); try { onOpen({ ...(await api<Source>("/api/discover/open", { body: { url } })), origin: "url" }); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}>
      <label className="block text-sm font-medium">Link to a French article<input className="input mt-1" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></label>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Opening…" : "Open"}</button>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </form>
  );
}

function PasteTab({ onOpen }: { onOpen: (s: Source) => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  return (
    <form className="card space-y-2" onSubmit={(e) => { e.preventDefault(); onOpen({ origin: "pasted", title: title.trim() || "My text", text: text.trim() }); }}>
      <label className="block text-sm font-medium">Title (optional)<input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></label>
      <label className="block text-sm font-medium">French text<textarea className="input mt-1 min-h-48" lang="fr" value={text} onChange={(e) => setText(e.target.value)} maxLength={12000} required placeholder="Paste an article, a letter from school, an email…" /></label>
      <p className="text-xs text-muted">{text.trim().split(/\s+/).filter(Boolean).length} words · at least 15 words, up to about 2,000.</p>
      <button className="btn btn-primary" disabled={text.trim().length < 80}>Read and practise</button>
    </form>
  );
}

function SavedTab({ onOpen }: { onOpen: (s: Source, l: WebLesson) => void }) {
  const [items, setItems] = useState<Saved[] | null>(null);
  useEffect(() => { api<{ items: Saved[] }>("/api/discover/saved").then((r) => setItems(r.items)).catch(() => setItems([])); }, []);
  if (!items) return <p className="text-muted">Loading…</p>;
  if (!items.length) return <p className="card text-sm text-muted">Texts you turn into exercises are saved here (only a short excerpt and the link).</p>;
  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li key={s.id} className="card flex flex-wrap items-center gap-2">
          <div className="flex-1"><p className="font-medium" lang="fr">{s.title}</p><p className="text-xs text-muted">{s.publisher ?? s.origin} · {new Date(s.retrievedAt).toLocaleDateString()}{s.difficultyEstimate ? ` · about ${s.difficultyEstimate}` : ""}</p></div>
          <button className="btn btn-secondary btn-sm" onClick={async () => { const r = await api<{ title: string; url: string | null; publisher: string | null; publishedAt: string | null; excerpt: string; origin: Source["origin"]; lesson: WebLesson; retrievedAt: string }>(`/api/discover/saved/${s.id}`); onOpen({ origin: r.origin, title: r.title, url: r.url, publisher: r.publisher, publishedAt: r.publishedAt, text: r.excerpt, retrievedAt: r.retrievedAt }, r.lesson); }}>Open</button>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await api(`/api/discover/saved/${s.id}`, { method: "DELETE" }); setItems(items.filter((x) => x.id !== s.id)); }}>Delete</button>
        </li>
      ))}
    </ul>
  );
}

function Reader({ source: s, lesson, setLesson, onBack }: { source: Source; lesson: { lesson: WebLesson; note?: string } | null; setLesson: (l: { lesson: WebLesson; note?: string }) => void; onBack: () => void }) {
  const { providers } = usePrefs();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useAi, setUseAi] = useState(true);
  const make = async () => {
    setBusy(true); setError(null);
    try { setLesson(await api<{ lesson: WebLesson; note?: string }>("/api/discover/lesson", { body: { origin: s.origin, url: s.url ?? null, title: s.title, publisher: s.publisher ?? null, publishedAt: s.publishedAt ?? null, text: s.text, useAi } })); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const L = lesson?.lesson;
  return (
    <div className="space-y-4">
      <button className="text-sm underline" onClick={onBack}>← Back</button>
      <article className="card space-y-2">
        <h2 className="text-xl font-semibold" lang="fr">{s.title}</h2>
        <p className="text-xs text-muted">
          {s.origin === "pasted" ? "Text you pasted" : <>Source: {s.publisher ?? "web page"}{s.publishedAt ? ` · published ${s.publishedAt.slice(0, 10)}` : ""}{s.retrievedAt ? ` · retrieved ${new Date(s.retrievedAt).toLocaleString()}` : ""} · {s.url && <a className="underline" href={s.url} target="_blank" rel="noopener noreferrer">original ↗</a>}</>}
        </p>
        {s.origin !== "pasted" && <p className="text-xs text-muted">© the publisher{s.license ? ` (licence: ${s.license})` : ""}. Shown for your personal study; read and share it on the original site.</p>}
        {s.frenchScore !== undefined && s.frenchScore < 0.08 && <p role="alert" className="text-sm">This page doesn&apos;t look like it&apos;s in French.</p>}
        <div className="max-h-[60vh] overflow-auto rounded-lg surface-2 p-3"><TappableText text={s.text} sourceRef={s.url ?? "pasted"} /></div>
      </article>
      {!L && (
        <div className="card space-y-2">
          {providers.ai.available ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} /> Use AI for a summary and comprehension questions</label>
            : <p className="text-sm text-muted">No AI is configured, so you&apos;ll get a rule-based study kit (not AI): vocabulary from the dictionary, gap-fills and a rough difficulty estimate. Comprehension questions need AI.</p>}
          <button className="btn btn-primary" disabled={busy} onClick={make}>{busy ? "Preparing…" : "Make a study kit"}</button>
          {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        </div>
      )}
      {L && (
        <section className="card space-y-4" aria-label="Study kit">
          <p className={`chip w-fit ${L.isDemo ? "bg-saffron-100 text-saffron-700" : "bg-brand-100 text-brand-900"}`}>{L.label}</p>
          {lesson?.note && <p className="text-xs text-muted">{lesson.note}</p>}
          <p className="text-sm"><strong>Difficulty:</strong> about {L.estimate.level} · {Math.round(L.estimate.knownShare * 100)}% of words found in the course dictionary · {L.estimate.avgSentenceWords} words per sentence on average. <span className="text-muted">{L.estimate.note}</span></p>
          {L.summary && <div><h3 className="font-semibold">Summary</h3><Bi t={L.summary} /></div>}
          {L.vocab.length > 0 && (
            <div>
              <h3 className="font-semibold">Words to learn</h3>
              <ul className="mt-1 space-y-1">{L.vocab.map((v) => <li key={v.lemma} className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium" lang="fr">{v.lemma}</span><Speak text={v.lemma} showSlow={false} /><span>{v.en}</span><span lang="hi" className="deva text-muted">{v.hi}</span>{v.level && <span className="chip text-xs">{v.level}</span>}<SaveWordButton word={{ fr: v.lemma, en: v.en, hi: v.hi, entryId: v.entryId }} source="web" sourceRef={s.url ?? "pasted"} /></li>)}</ul>
            </div>
          )}
          {L.gapFill.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Fill the gaps</h3>
              {L.gapFill.map((g, i) => <GapFill key={i} text={g.sentence} answers={[g.answer]} itemRef={`web:${s.url ?? "pasted"}:gap:${i}`} skill="reading" />)}
            </div>
          )}
          {L.questions.length > 0 && <div className="space-y-3"><h3 className="font-semibold">Comprehension</h3>{L.questions.map((q, i) => <LocalMcq key={i} q={q} i={i} />)}</div>}
        </section>
      )}
    </div>
  );
}

function LocalMcq({ q, i }: { q: WebLesson["questions"][number]; i: number }) {
  const [c, setC] = useState<number | null>(null);
  return (
    <fieldset className="rounded-xl border border-app p-3">
      <legend className="px-1 font-medium">{i + 1}. {q.q.fr && <span lang="fr" className="block">{q.q.fr}</span>}<span className={q.q.fr ? "text-sm text-muted" : ""}>{q.q.en}</span></legend>
      <div className="mt-2 grid gap-2">{q.options.map((o, j) => <label key={j} className={`flex gap-2 rounded-lg border p-2 ${c === null ? "border-app" : j === q.answer ? "border-green-600" : j === c ? "border-red-500" : "border-app"}`}><input type="radio" name={`wq-${i}`} disabled={c !== null} onChange={() => setC(j)} /><span lang="fr">{o}</span></label>)}</div>
      {c !== null && <div className="mt-2 text-sm"><p className="font-medium">{c === q.answer ? "Correct" : "Not quite"}</p><Bi t={q.explanation} /><p className="mt-1">Evidence: <q lang="fr">{q.evidence}</q></p></div>}
    </fieldset>
  );
}
