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
import { Bi, useBiLabel } from "./bi";

type Curated = { title: string; url: string; publisher: string; level: string; kind: string };
type Source = { origin: "search" | "url" | "pasted"; url?: string | null; title: string; publisher?: string | null; publishedAt?: string | null; retrievedAt?: string; text: string; license?: string | null; frenchScore?: number };
type Saved = { id: string; title: string; url: string | null; publisher: string | null; origin: string; difficultyEstimate: string | null; retrievedAt: string };
type Tab = "search" | "link" | "paste" | "curated" | "saved";

export function Discover({ curated }: { curated: Curated[] }) {
  const { providers } = usePrefs();
  const [tab, setTab] = useState<Tab>(providers.search.available ? "search" : "paste");
  const [source, setSource] = useState<Source | null>(null);
  const [lesson, setLesson] = useState<{ lesson: WebLesson; note?: string } | null>(null);
  const label = useBiLabel();
  const tabs: { id: Tab; label: { en: string; hi: string } }[] = [
    { id: "search", label: { en: "Search the web", hi: "वेब पर खोजें" } }, { id: "link", label: { en: "Open a link", hi: "लिंक खोलें" } }, { id: "paste", label: { en: "Paste text", hi: "पाठ चिपकाएँ" } }, { id: "curated", label: { en: "Curated sites", hi: "चुनी हुई साइटें" } }, { id: "saved", label: { en: "My saved texts", hi: "मेरे सहेजे पाठ" } },
  ];
  if (source) return <Reader source={source} lesson={lesson} setLesson={setLesson} onBack={() => { setSource(null); setLesson(null); }} />;
  return (
    <div className="space-y-4">
      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={`btn btn-sm ${tab === t.id ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(t.id)}>{label(t.label)}</button>)}
      </div>
      <Bi className="text-xs text-muted" t={{ en: "Web pages are third-party content. The app reads them as text only, never follows instructions in them, keeps just a short excerpt with the link, and the copyright stays with the publisher.", hi: "वेब पेज दूसरों की सामग्री हैं। ऐप उन्हें केवल पाठ के रूप में पढ़ता है, उनमें लिखे किसी निर्देश का पालन नहीं करता, लिंक के साथ बस एक छोटा अंश रखता है, और कॉपीराइट प्रकाशक के पास ही रहता है।" }} />
      {tab === "search" && <SearchTab onOpen={setSource} />}
      {tab === "link" && <LinkTab onOpen={setSource} />}
      {tab === "paste" && <PasteTab onOpen={setSource} />}
      {tab === "curated" && (
        <div className="space-y-2">
          <Bi className="text-sm text-muted" t={{ en: "Curated starting points, chosen by hand (not search results). They open on the publisher's site. To practise with an article from one of them, copy its link into “Open a link”.", hi: "हाथ से चुनी गई शुरुआती साइटें (खोज परिणाम नहीं)। ये प्रकाशक की साइट पर खुलती हैं। इनमें से किसी लेख से अभ्यास करने के लिए उसका लिंक कॉपी करके “लिंक खोलें” में डालें।" }} />
          <ul className="grid gap-2 sm:grid-cols-2">{curated.map((c) => <li key={c.url} className="card"><a href={c.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">{c.title} ↗</a><p className="text-xs text-muted">{c.publisher} · {c.level}{c.kind === "official" ? ` · ${label({ en: "official source", hi: "आधिकारिक स्रोत" })}` : ""}</p></li>)}</ul>
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
  const label = useBiLabel();
  if (!providers.search.available) return <Bi className="card text-sm" t={{ en: "Web search isn't configured on this server (it needs a Brave Search or Tavily key). You can still open a link, paste text, or use the curated sites.", hi: "इस सर्वर पर वेब खोज सेट नहीं है (इसके लिए Brave Search या Tavily की कुंजी चाहिए)। आप फिर भी लिंक खोल सकते हैं, पाठ चिपका सकते हैं या चुनी हुई साइटें इस्तेमाल कर सकते हैं।" }} />;
  const run = async () => { setError(null); setResults(null); try { setResults((await api<{ results: SearchResult[] }>(`/api/discover/search?q=${encodeURIComponent(q)}&kind=${kind}`)).results); } catch (e) { setError((e as Error).message); } };
  const open = async (r: SearchResult) => {
    setOpening(r.url); setError(null);
    try { const p = await api<Source & { url: string }>("/api/discover/open", { body: { url: r.url } }); onOpen({ ...p, origin: "search", publishedAt: p.publishedAt ?? r.publishedAt ?? null }); }
    catch (e) { setError((e as Error).message); } finally { setOpening(null); }
  };
  return (
    <div className="space-y-3">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <label htmlFor="dq" className="sr-only">{label({ en: "Search", hi: "खोजें" })}</label>
        <input id="dq" className="input flex-1" lang="fr" value={q} onChange={(e) => setQ(e.target.value)} placeholder="logement Montréal, hiver, emploi…" />
        <select className="input w-auto" value={kind} onChange={(e) => setKind(e.target.value as "web" | "news")} aria-label={label({ en: "Search type", hi: "खोज का प्रकार" })}><option value="news">{label({ en: "News", hi: "समाचार" })}</option><option value="web">{label({ en: "Web", hi: "वेब" })}</option></select>
        <button className="btn btn-primary" disabled={q.trim().length < 2}>{label({ en: "Search", hi: "खोजें" })}</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {results?.length === 0 && <Bi className="text-sm text-muted" t={{ en: "No results.", hi: "कोई परिणाम नहीं मिला।" }} />}
      <ul className="space-y-2">
        {results?.map((r) => (
          <li key={r.url} className="card space-y-1">
            <p className="font-medium" lang="fr">{r.title}</p>
            <p className="text-xs text-muted">{r.domain}{r.publishedAt ? ` · ${r.publishedAt}` : ""} · {label({ en: "via", hi: "स्रोत:" })} {r.provider}</p>
            <p className="text-sm" lang="fr">{r.snippet}</p>
            <div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={!!opening} onClick={() => open(r)}>{opening === r.url ? label({ en: "Opening…", hi: "खुल रहा है…" }) : label({ en: "Read and practise", hi: "पढ़ें और अभ्यास करें" })}</button><a className="btn btn-ghost btn-sm" href={r.url} target="_blank" rel="noopener noreferrer">{label({ en: "Original", hi: "मूल पेज" })} ↗</a></div>
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
  const label = useBiLabel();
  return (
    <form className="card space-y-2" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(null); try { onOpen({ ...(await api<Source>("/api/discover/open", { body: { url } })), origin: "url" }); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}>
      <label className="block text-sm font-medium">{label({ en: "Link to a French article", hi: "किसी फ़्रेंच लेख का लिंक" })}<input className="input mt-1" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></label>
      <button className="btn btn-primary" disabled={busy}>{busy ? label({ en: "Opening…", hi: "खुल रहा है…" }) : label({ en: "Open", hi: "खोलें" })}</button>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </form>
  );
}

function PasteTab({ onOpen }: { onOpen: (s: Source) => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const label = useBiLabel();
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return (
    <form className="card space-y-2" onSubmit={(e) => { e.preventDefault(); onOpen({ origin: "pasted", title: title.trim() || label({ en: "My text", hi: "मेरा पाठ" }), text: text.trim() }); }}>
      <label className="block text-sm font-medium">{label({ en: "Title (optional)", hi: "शीर्षक (वैकल्पिक)" })}<input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></label>
      <label className="block text-sm font-medium">{label({ en: "French text", hi: "फ़्रेंच पाठ" })}<textarea className="input mt-1 min-h-48" lang="fr" value={text} onChange={(e) => setText(e.target.value)} maxLength={12000} required placeholder={label({ en: "Paste an article, a letter from school, an email…", hi: "कोई लेख, स्कूल का पत्र, ईमेल… यहाँ चिपकाएँ" })} /></label>
      <Bi className="text-xs text-muted" t={{ en: `${words} words · at least 15 words, up to about 2,000.`, hi: `${words} शब्द · कम से कम 15 शब्द, लगभग 2,000 तक।` }} />
      <button className="btn btn-primary" disabled={text.trim().length < 80}>{label({ en: "Read and practise", hi: "पढ़ें और अभ्यास करें" })}</button>
    </form>
  );
}

function SavedTab({ onOpen }: { onOpen: (s: Source, l: WebLesson) => void }) {
  const [items, setItems] = useState<Saved[] | null>(null);
  const label = useBiLabel();
  useEffect(() => { api<{ items: Saved[] }>("/api/discover/saved").then((r) => setItems(r.items)).catch(() => setItems([])); }, []);
  if (!items) return <Bi className="text-muted" t={{ en: "Loading…", hi: "लोड हो रहा है…" }} />;
  if (!items.length) return <Bi className="card text-sm text-muted" t={{ en: "Texts you turn into exercises are saved here (only a short excerpt and the link).", hi: "जिन पाठों से आप अभ्यास बनाते हैं, वे यहाँ सहेजे जाते हैं (बस एक छोटा अंश और लिंक)।" }} />;
  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li key={s.id} className="card flex flex-wrap items-center gap-2">
          <div className="flex-1"><p className="font-medium" lang="fr">{s.title}</p><p className="text-xs text-muted">{s.publisher ?? s.origin} · {new Date(s.retrievedAt).toLocaleDateString()}{s.difficultyEstimate ? ` · ${label({ en: `about ${s.difficultyEstimate}`, hi: `लगभग ${s.difficultyEstimate}` })}` : ""}</p></div>
          <button className="btn btn-secondary btn-sm" onClick={async () => { const r = await api<{ title: string; url: string | null; publisher: string | null; publishedAt: string | null; excerpt: string; origin: Source["origin"]; lesson: WebLesson; retrievedAt: string }>(`/api/discover/saved/${s.id}`); onOpen({ origin: r.origin, title: r.title, url: r.url, publisher: r.publisher, publishedAt: r.publishedAt, text: r.excerpt, retrievedAt: r.retrievedAt }, r.lesson); }}>{label({ en: "Open", hi: "खोलें" })}</button>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await api(`/api/discover/saved/${s.id}`, { method: "DELETE" }); setItems(items.filter((x) => x.id !== s.id)); }}>{label({ en: "Delete", hi: "हटाएँ" })}</button>
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
  const label = useBiLabel();
  const make = async () => {
    setBusy(true); setError(null);
    try { setLesson(await api<{ lesson: WebLesson; note?: string }>("/api/discover/lesson", { body: { origin: s.origin, url: s.url ?? null, title: s.title, publisher: s.publisher ?? null, publishedAt: s.publishedAt ?? null, text: s.text, useAi } })); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const L = lesson?.lesson;
  return (
    <div className="space-y-4">
      <button className="text-sm underline" onClick={onBack}>← {label({ en: "Back", hi: "पीछे" })}</button>
      <article className="card space-y-2">
        <h2 className="text-xl font-semibold" lang="fr">{s.title}</h2>
        <p className="text-xs text-muted">
          {s.origin === "pasted" ? label({ en: "Text you pasted", hi: "आपका चिपकाया पाठ" }) : <>{label({ en: "Source", hi: "स्रोत" })}: {s.publisher ?? label({ en: "web page", hi: "वेब पेज" })}{s.publishedAt ? ` · ${label({ en: "published", hi: "प्रकाशित" })} ${s.publishedAt.slice(0, 10)}` : ""}{s.retrievedAt ? ` · ${label({ en: "retrieved", hi: "लिया गया" })} ${new Date(s.retrievedAt).toLocaleString()}` : ""} · {s.url && <a className="underline" href={s.url} target="_blank" rel="noopener noreferrer">{label({ en: "original", hi: "मूल पेज" })} ↗</a>}</>}
        </p>
        {s.origin !== "pasted" && <Bi className="text-xs text-muted" t={{ en: `© the publisher${s.license ? ` (licence: ${s.license})` : ""}. Shown for your personal study; read and share it on the original site.`, hi: `© प्रकाशक${s.license ? ` (लाइसेंस: ${s.license})` : ""}। यह केवल आपकी निजी पढ़ाई के लिए दिखाया गया है; इसे पढ़ने और साझा करने के लिए मूल साइट पर जाएँ।` }} />}
        {s.frenchScore !== undefined && s.frenchScore < 0.08 && <p role="alert" className="text-sm"><Bi as="span" t={{ en: "This page doesn't look like it's in French.", hi: "यह पेज फ़्रेंच में नहीं लगता।" }} /></p>}
        <div className="max-h-[60vh] overflow-auto rounded-lg surface-2 p-3"><TappableText text={s.text} sourceRef={s.url ?? "pasted"} /></div>
      </article>
      {!L && (
        <div className="card space-y-2">
          {providers.ai.available ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} /> <Bi as="span" t={{ en: "Use AI for a summary and comprehension questions", hi: "सारांश और समझ वाले प्रश्नों के लिए AI इस्तेमाल करें" }} /></label>
            : <Bi className="text-sm text-muted" t={{ en: "No AI is configured, so you'll get a rule-based study kit (not AI): vocabulary from the dictionary, gap-fills and a rough difficulty estimate. Comprehension questions need AI.", hi: "कोई AI सेट नहीं है, इसलिए आपको नियम-आधारित अभ्यास किट (AI नहीं) मिलेगी: शब्दकोश से शब्दावली, खाली जगह भरने के अभ्यास और कठिनाई का मोटा अनुमान। समझ वाले प्रश्नों के लिए AI चाहिए।" }} />}
          <button className="btn btn-primary" disabled={busy} onClick={make}>{busy ? label({ en: "Preparing…", hi: "तैयार हो रहा है…" }) : label({ en: "Make a study kit", hi: "अभ्यास किट बनाएँ" })}</button>
          {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        </div>
      )}
      {L && (
        <section className="card space-y-4" aria-label={label({ en: "Study kit", hi: "अभ्यास किट" })}>
          <p className={`chip w-fit ${L.isDemo ? "bg-saffron-100 text-saffron-700" : "bg-brand-100 text-brand-900"}`}>{label({ en: L.label, hi: L.isDemo ? "नियम-आधारित अभ्यास किट (AI नहीं)" : "AI से बना अभ्यास। प्रश्नों को पाठ के उद्धरणों से मिलाकर जाँचा गया है; फिर भी जो ग़लत लगे, उसे ख़ुद जाँच लें।" })}</p>
          {lesson?.note && <p className="text-xs text-muted">{lesson.note}</p>}
          <p className="text-sm"><strong>{label({ en: "Difficulty:", hi: "कठिनाई:" })}</strong> {label({ en: `about ${L.estimate.level} · ${Math.round(L.estimate.knownShare * 100)}% of words found in the course dictionary · ${L.estimate.avgSentenceWords} words per sentence on average.`, hi: `लगभग ${L.estimate.level} · ${Math.round(L.estimate.knownShare * 100)}% शब्द पाठ्यक्रम के शब्दकोश में मिले · औसतन हर वाक्य में ${L.estimate.avgSentenceWords} शब्द।` })} <span className="text-muted">{L.estimate.note}</span></p>
          {L.summary && <div><h3 className="font-semibold">{label({ en: "Summary", hi: "सारांश" })}</h3><Bi t={L.summary} /></div>}
          {L.vocab.length > 0 && (
            <div>
              <h3 className="font-semibold">{label({ en: "Words to learn", hi: "सीखने के शब्द" })}</h3>
              <ul className="mt-1 space-y-1">{L.vocab.map((v) => <li key={v.lemma} className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium" lang="fr">{v.lemma}</span><Speak text={v.lemma} showSlow={false} /><span>{v.en}</span><span lang="hi" className="deva text-muted">{v.hi}</span>{v.level && <span className="chip text-xs">{v.level}</span>}<SaveWordButton word={{ fr: v.lemma, en: v.en, hi: v.hi, entryId: v.entryId }} source="web" sourceRef={s.url ?? "pasted"} /></li>)}</ul>
            </div>
          )}
          {L.gapFill.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">{label({ en: "Fill the gaps", hi: "खाली जगह भरें" })}</h3>
              {L.gapFill.map((g, i) => <GapFill key={i} text={g.sentence} answers={[g.answer]} itemRef={`web:${s.url ?? "pasted"}:gap:${i}`} skill="reading" />)}
            </div>
          )}
          {L.questions.length > 0 && <div className="space-y-3"><h3 className="font-semibold">{label({ en: "Comprehension", hi: "समझ के प्रश्न" })}</h3>{L.questions.map((q, i) => <LocalMcq key={i} q={q} i={i} />)}</div>}
        </section>
      )}
    </div>
  );
}

function LocalMcq({ q, i }: { q: WebLesson["questions"][number]; i: number }) {
  const [c, setC] = useState<number | null>(null);
  const label = useBiLabel();
  return (
    <fieldset className="rounded-xl border border-app p-3">
      <legend className="px-1 font-medium">{i + 1}. {q.q.fr && <span lang="fr" className="block">{q.q.fr}</span>}<span className={q.q.fr ? "text-sm text-muted" : ""}>{q.q.en}</span></legend>
      <div className="mt-2 grid gap-2">{q.options.map((o, j) => <label key={j} className={`flex gap-2 rounded-lg border p-2 ${c === null ? "border-app" : j === q.answer ? "border-green-600" : j === c ? "border-red-500" : "border-app"}`}><input type="radio" name={`wq-${i}`} disabled={c !== null} onChange={() => setC(j)} /><span lang="fr">{o}</span></label>)}</div>
      {c !== null && <div className="mt-2 text-sm"><p className="font-medium">{c === q.answer ? label({ en: "Correct", hi: "सही" }) : label({ en: "Not quite", hi: "पूरी तरह सही नहीं" })}</p><Bi t={q.explanation} /><p className="mt-1">{label({ en: "Evidence:", hi: "पाठ में प्रमाण:" })} <q lang="fr">{q.evidence}</q></p></div>}
    </fieldset>
  );
}
