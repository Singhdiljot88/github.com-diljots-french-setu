"use client";
import { useMemo, useState } from "react";
import type { PronunciationContent } from "@/content/pronunciation-schema";
import { api } from "@/lib/api-client";
import { Speak, usePlayer, AudioSourceNote, AudioError, type VoiceKey } from "./audio";
import { Bi, useBiLabel } from "./bi";
import { HindiBridge } from "./hindi-bridge";
import { Pron } from "./fr-item";
import { Recorder } from "./recorder";
import { usePrefs } from "./prefs";
import { SayIt, type SayItem } from "./say-it";

export type ShadowLine = { day: number; fr: string; en: string; hi: string; voice: VoiceKey };
type Tab = "say" | "sounds" | "pairs" | "liaison" | "shadowing";
const TABS: { id: Tab; en: string; hi: string }[] = [
  { id: "say", en: "Say it", hi: "बोलकर जाँचें" },
  { id: "sounds", en: "Sounds", hi: "ध्वनियाँ" }, { id: "pairs", en: "Minimal pairs", hi: "मिलते-जुलते शब्द" },
  { id: "liaison", en: "Liaison", hi: "शब्दों का जुड़ना" }, { id: "shadowing", en: "Shadowing", hi: "साथ-साथ बोलना" },
];
const GROUPS = {
  vowel: { en: "Vowels", hi: "स्वर" }, nasal: { en: "Nasal vowels", hi: "नाक से बोले जाने वाले स्वर" }, consonant: { en: "Consonants", hi: "व्यंजन" }, spelling: { en: "Spelling", hi: "वर्तनी" },
} as const;
const STATUS_HI: Record<string, string> = { "AI-drafted, editorial review pending": "AI से तैयार मसौदा, संपादकीय जाँच अभी बाक़ी" };

export function PronunciationLab({ content, shadow, say, today, initialSound, initialTab }: { content: PronunciationContent; shadow: ShadowLine[]; say: SayItem[]; today: number; initialSound?: string; initialTab?: string }) {
  const [tab, setTab] = useState<Tab>((TABS.find((t) => t.id === initialTab)?.id) ?? "sounds");
  const { providers } = usePrefs();
  const label = useBiLabel();
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={label({ en: "Pronunciation lab sections", hi: "उच्चारण लैब के हिस्से" })} className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} className={`btn btn-sm ${tab === t.id ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(t.id)}>
            <Bi as="span" t={t} />
          </button>
        ))}
      </div>
      <AudioSourceNote />
      {!providers.pronunciation.available && <Bi className="text-xs text-muted" t={{ en: "No pronunciation score is shown: automatic scoring needs a speech-assessment service (Azure) on the server. Compare your recording with the model by ear.", hi: "उच्चारण के लिए कोई अंक नहीं दिखाए जाते: अपने-आप अंक देने के लिए सर्वर पर बोली जाँचने वाली सेवा (Azure) चाहिए। अपनी रिकॉर्डिंग की तुलना नमूने से कान से करें।" }} />}
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "say" && <SayIt items={say} today={today} />}
        {tab === "sounds" && <Sounds content={content} initial={initialSound} />}
        {tab === "pairs" && <MinimalPairs sets={content.minimalPairs} />}
        {tab === "liaison" && <Liaison l={content.liaison} />}
        {tab === "shadowing" && <Shadowing lines={shadow} />}
      </div>
      <Bi className="text-xs text-muted" t={{ en: `Lab content: ${content.status}.`, hi: STATUS_HI[content.status] ? `लैब की सामग्री: ${STATUS_HI[content.status]}।` : undefined }} />
    </div>
  );
}

function Sounds({ content, initial }: { content: PronunciationContent; initial?: string }) {
  const [id, setId] = useState(initial && content.sounds.some((s) => s.id === initial) ? initial : content.sounds[0].id);
  const s = content.sounds.find((x) => x.id === id)!;
  const label = useBiLabel();
  return (
    <div className="space-y-4">
      {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
        <div key={g}>
          <p className="mb-1 text-xs uppercase tracking-wide text-muted">{label(GROUPS[g])}</p>
          <div className="flex flex-wrap gap-2">
            {content.sounds.filter((x) => x.group === g).map((x) => (
              <button key={x.id} type="button" onClick={() => setId(x.id)} aria-pressed={x.id === id} className={`btn btn-sm ${x.id === id ? "btn-primary" : "btn-secondary"}`}>
                <span lang="fr">{x.spelling.split(/[,(]/)[0].trim()}</span>{x.ipa !== "—" && <span className="font-mono text-xs opacity-80"> /{x.ipa}/</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      <article className="card space-y-3" aria-labelledby="snd-h">
        <h2 id="snd-h" className="text-xl font-semibold"><Bi as="span" t={s.name} /></h2>
        <p className="text-sm"><span className="text-muted">IPA</span> <span className="font-mono">/{s.ipa}/</span> · <span className="text-muted">{label({ en: "Spelled", hi: "वर्तनी" })}</span> <span lang="fr">{s.spelling}</span> · <span className="text-muted">{label({ en: "Difficulty for Hindi speakers", hi: "हिंदी बोलने वालों के लिए कठिनाई" })}</span> {"●".repeat(s.difficulty)}{"○".repeat(3 - s.difficulty)}</p>
        {s.group === "nasal" && <HindiBridge topic="nasals" />}
        <div className="rounded-lg surface-2 p-3"><p className="text-sm font-semibold">👄 {label({ en: "Mouth position", hi: "मुँह की स्थिति" })}</p><Bi t={s.mouth} /></div>
        <div className="rounded-lg border border-saffron-500/50 p-3"><p className="text-sm font-semibold">⚠️ {label({ en: "Common trap", hi: "आम ग़लती" })}</p><Bi t={s.trap} /></div>
        <ul className="space-y-4">
          {s.examples.map((e, i) => (
            <li key={i} className="space-y-1">
              <div className="flex flex-wrap items-center gap-2"><span className="text-lg font-medium" lang="fr">{e.fr}</span><Speak text={e.fr} /><span className="text-sm text-muted">{e.en}</span></div>
              <Pron pron={e.pron} />
              <Recorder model={e.fr} refKey={`pron:${s.id}:${i}`} compact />
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}

function MinimalPairs({ sets }: { sets: PronunciationContent["minimalPairs"] }) {
  const [setIdx, setSetIdx] = useState(0);
  const set = sets[setIdx];
  const label = useBiLabel();
  return (
    <div className="space-y-4">
      <label className="block text-sm">{label({ en: "Contrast", hi: "ध्वनियों का अंतर" })}
        <select className="input mt-1 w-auto" value={setIdx} onChange={(e) => setSetIdx(Number(e.target.value))}>
          {sets.map((s, i) => <option key={s.contrast} value={i}>{label(s.label)}</option>)}
        </select>
      </label>
      <div className="card space-y-2">
        <h2 className="font-semibold">{label({ en: "Listen to both", hi: "दोनों सुनें" })}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {set.pairs.map(([a, b]) => (
            <li key={a + b} className="flex flex-wrap items-center gap-2 rounded-lg surface-2 p-2" lang="fr">
              <span className="font-medium">{a}</span><Speak text={a} showSlow={false} /><span className="text-muted">{label({ en: "vs", hi: "बनाम" })}</span><span className="font-medium">{b}</span><Speak text={b} showSlow={false} />
            </li>
          ))}
        </ul>
      </div>
      <PairQuiz key={set.contrast} set={set} />
    </div>
  );
}

function PairQuiz({ set }: { set: PronunciationContent["minimalPairs"][number] }) {
  const ROUNDS = 8;
  const rounds = useMemo(() => Array.from({ length: ROUNDS }, () => { const p = set.pairs[Math.floor(Math.random() * set.pairs.length)]; return { pair: p, target: Math.random() < 0.5 ? 0 : 1 }; }), [set]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const { play, error } = usePlayer();
  const label = useBiLabel();
  const r = rounds[i];
  if (i >= ROUNDS) {
    return (
      <div className="card space-y-2">
        <p className="text-lg font-semibold">{label({ en: `${score} / ${ROUNDS} heard correctly`, hi: `${ROUNDS} में से ${score} सही सुने` })}</p>
        <Bi className="text-sm text-muted" t={score === ROUNDS ? { en: "Your ear can tell these apart. Now practise saying them.", hi: "आपका कान इनका अंतर पहचान लेता है। अब इन्हें बोलने का अभ्यास करें।" } : { en: "Listen to the pairs above a few more times, then try again.", hi: "ऊपर दी गई जोड़ियों को कुछ बार और सुनें, फिर दोबारा कोशिश करें।" }} />
        <button className="btn btn-primary btn-sm" onClick={() => { setI(0); setScore(0); setPicked(null); }}>{label({ en: "Try again", hi: "फिर से कोशिश करें" })}</button>
      </div>
    );
  }
  const choose = async (k: number) => {
    setPicked(k);
    const ok = k === r.target;
    if (ok) setScore((s) => s + 1);
    api("/api/attempts", { body: { kind: "minimal_pair", itemRef: `pair:${set.contrast}:${r.pair[r.target]}`, skill: "pronunciation", correct: ok, response: { heard: r.pair[r.target], chose: r.pair[k] } } }).catch(() => {});
  };
  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">{label({ en: "Which word do you hear?", hi: "आपको कौन-सा शब्द सुनाई देता है?" })} <span className="text-sm font-normal text-muted">({label({ en: `${i + 1} of ${ROUNDS}`, hi: `${ROUNDS} में से ${i + 1}` })})</span></h2>
      <button className="btn btn-secondary" onClick={() => play([{ text: r.pair[r.target] }])}>▶ {label({ en: "Play", hi: "सुनें" })}</button>
      <AudioError error={error} />
      <div className="grid grid-cols-2 gap-2">
        {r.pair.map((w, k) => (
          <button key={k} lang="fr" disabled={picked !== null} onClick={() => choose(k)}
            className={`btn text-lg ${picked === null ? "btn-secondary" : k === r.target ? "border-2 border-green-600" : k === picked ? "border-2 border-red-500" : "btn-secondary"}`}>{w}</button>
        ))}
      </div>
      {picked !== null && (
        <div className="flex items-center gap-2" aria-live="polite">
          <span>{picked === r.target ? `✓ ${label({ en: "Right", hi: "सही" })}` : label({ en: `It was “${r.pair[r.target]}”`, hi: `यह “${r.pair[r.target]}” था` })}</span>
          <button className="btn btn-primary btn-sm ml-auto" onClick={() => { setPicked(null); setI(i + 1); }}>{label({ en: "Next", hi: "आगे" })}</button>
        </div>
      )}
      <Bi className="text-xs text-muted" t={{ en: "Synthetic voices can blur some contrasts. If two words sound identical here, trust the explanation in Sounds.", hi: "कंप्यूटर से बनी आवाज़ें कुछ अंतर धुँधले कर सकती हैं। अगर यहाँ दो शब्द एक जैसे सुनाई दें, तो “ध्वनियाँ” में दी गई व्याख्या पर भरोसा करें।" }} />
    </div>
  );
}

function Liaison({ l }: { l: PronunciationContent["liaison"] }) {
  return (
    <div className="space-y-3">
      <div className="card"><Bi t={l.intro} /></div>
      {l.groups.map((g, gi) => (
        <section key={gi} className="card space-y-2">
          <Bi t={g.rule} className="font-medium" />
          <ul className="space-y-3">
            {g.examples.map((e, i) => (
              <li key={i} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2"><span className="text-lg" lang="fr">{e.fr}</span><Speak text={e.fr} /><span className="text-sm text-muted">{e.en}</span></div>
                <Pron pron={e.pron} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Shadowing({ lines }: { lines: ShadowLine[] }) {
  const [i, setI] = useState(0);
  const [slow, setSlow] = useState(true);
  const { play, playing, error } = usePlayer();
  const label = useBiLabel();
  if (!lines.length) return <Bi className="card text-muted" t={{ en: "Shadowing lines come from your lesson dialogues. Start Day 1 first.", hi: "साथ-साथ बोलने की पंक्तियाँ आपके पाठों की बातचीत से आती हैं। पहले दिन 1 शुरू करें।" }} />;
  const l = lines[i];
  return (
    <div className="card space-y-3">
      <Bi t={{ en: "Play the line, then say it at the same time as the voice (shadowing), copying rhythm and melody. Then record yourself alone and compare.", hi: "पंक्ति चलाइए, फिर आवाज़ के साथ-साथ बोलिए (shadowing), लय और सुर की नक़ल करते हुए। फिर अकेले रिकॉर्ड करके तुलना कीजिए।" }} className="text-sm" />
      <p className="text-xs text-muted">{label({ en: `Line ${i + 1} of ${lines.length} · from Day ${l.day}`, hi: `${lines.length} में से पंक्ति ${i + 1} · दिन ${l.day} से` })}</p>
      <p className="text-xl" lang="fr">{l.fr}</p>
      <Bi className="text-sm text-muted" t={{ en: l.en, hi: l.hi }} />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={() => play([{ text: l.fr, voice: l.voice }], { slow })}>{playing !== null ? label({ en: "Playing…", hi: "चल रहा है…" }) : `▶ ${label({ en: "Play", hi: "सुनें" })}`}</button>
        <button className="btn btn-secondary" onClick={async () => { for (let k = 0; k < 3; k++) { if (!(await play([{ text: l.fr, voice: l.voice }], { slow }))) break; await new Promise((r) => setTimeout(r, 1200)); } }}>🔁 {label({ en: "Play 3× with pauses", hi: "रुक-रुककर 3 बार सुनें" })}</button>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} /> {label({ en: "Slow", hi: "धीमा" })}</label>
      </div>
      <AudioError error={error} />
      <Recorder model={l.fr} voice={l.voice} refKey={`shadow:${l.day}:${i}`} />
      <div className="flex gap-2">
        <button className="btn btn-secondary btn-sm" disabled={i === 0} onClick={() => setI(i - 1)}>← {label({ en: "Previous", hi: "पीछे" })}</button>
        <button className="btn btn-secondary btn-sm" disabled={i >= lines.length - 1} onClick={() => setI(i + 1)}>{label({ en: "Next", hi: "आगे" })} →</button>
      </div>
    </div>
  );
}
