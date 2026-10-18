"use client";
import { useMemo, useState } from "react";
import type { PronunciationContent } from "@/content/pronunciation-schema";
import { api } from "@/lib/api-client";
import { Speak, usePlayer, AudioSourceNote, type VoiceKey } from "./audio";
import { Bi } from "./bi";
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
const GROUPS = { vowel: "Vowels", nasal: "Nasal vowels", consonant: "Consonants", spelling: "Spelling" } as const;

export function PronunciationLab({ content, shadow, say, today, initialSound, initialTab }: { content: PronunciationContent; shadow: ShadowLine[]; say: SayItem[]; today: number; initialSound?: string; initialTab?: string }) {
  const [tab, setTab] = useState<Tab>((TABS.find((t) => t.id === initialTab)?.id) ?? "sounds");
  const { providers } = usePrefs();
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Pronunciation lab sections" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} className={`btn btn-sm ${tab === t.id ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(t.id)}>
            {t.en} <span lang="hi" className="deva text-xs opacity-80">{t.hi}</span>
          </button>
        ))}
      </div>
      <AudioSourceNote />
      {!providers.pronunciation.available && <p className="text-xs text-muted">No pronunciation score is shown: automatic scoring needs a speech-assessment service (Azure) on the server. Compare your recording with the model by ear.</p>}
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "say" && <SayIt items={say} today={today} />}
        {tab === "sounds" && <Sounds content={content} initial={initialSound} />}
        {tab === "pairs" && <MinimalPairs sets={content.minimalPairs} />}
        {tab === "liaison" && <Liaison l={content.liaison} />}
        {tab === "shadowing" && <Shadowing lines={shadow} />}
      </div>
      <p className="text-xs text-muted">Lab content: {content.status}.</p>
    </div>
  );
}

function Sounds({ content, initial }: { content: PronunciationContent; initial?: string }) {
  const [id, setId] = useState(initial && content.sounds.some((s) => s.id === initial) ? initial : content.sounds[0].id);
  const s = content.sounds.find((x) => x.id === id)!;
  return (
    <div className="space-y-4">
      {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
        <div key={g}>
          <p className="mb-1 text-xs uppercase tracking-wide text-muted">{GROUPS[g]}</p>
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
        <h2 id="snd-h" className="text-xl font-semibold">{s.name.en} <span lang="hi" className="deva text-base font-normal text-muted">({s.name.hi})</span></h2>
        <p className="text-sm"><span className="text-muted">IPA</span> <span className="font-mono">/{s.ipa}/</span> · <span className="text-muted">Spelled</span> <span lang="fr">{s.spelling}</span> · <span className="text-muted">Difficulty for Hindi speakers</span> {"●".repeat(s.difficulty)}{"○".repeat(3 - s.difficulty)}</p>
        <div className="rounded-lg surface-2 p-3"><p className="text-sm font-semibold">👄 Mouth position</p><Bi t={s.mouth} /></div>
        <div className="rounded-lg border border-saffron-500/50 p-3"><p className="text-sm font-semibold">⚠️ Common trap</p><Bi t={s.trap} /></div>
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
  return (
    <div className="space-y-4">
      <label className="block text-sm">Contrast
        <select className="input mt-1 w-auto" value={setIdx} onChange={(e) => setSetIdx(Number(e.target.value))}>
          {sets.map((s, i) => <option key={s.contrast} value={i}>{s.label.en}</option>)}
        </select>
      </label>
      <div className="card space-y-2">
        <h2 className="font-semibold">Listen to both</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {set.pairs.map(([a, b]) => (
            <li key={a + b} className="flex flex-wrap items-center gap-2 rounded-lg surface-2 p-2" lang="fr">
              <span className="font-medium">{a}</span><Speak text={a} showSlow={false} /><span className="text-muted">vs</span><span className="font-medium">{b}</span><Speak text={b} showSlow={false} />
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
  const { play } = usePlayer();
  const r = rounds[i];
  if (i >= ROUNDS) {
    return (
      <div className="card space-y-2">
        <p className="text-lg font-semibold">{score} / {ROUNDS} heard correctly</p>
        <p className="text-sm text-muted">{score === ROUNDS ? "Your ear can tell these apart. Now practise saying them." : "Listen to the pairs above a few more times, then try again."}</p>
        <button className="btn btn-primary btn-sm" onClick={() => { setI(0); setScore(0); setPicked(null); }}>Try again</button>
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
      <h2 className="font-semibold">Which word do you hear? <span className="text-sm font-normal text-muted">({i + 1} of {ROUNDS})</span></h2>
      <button className="btn btn-secondary" onClick={() => play([{ text: r.pair[r.target] }])}>▶ Play</button>
      <div className="grid grid-cols-2 gap-2">
        {r.pair.map((w, k) => (
          <button key={k} lang="fr" disabled={picked !== null} onClick={() => choose(k)}
            className={`btn text-lg ${picked === null ? "btn-secondary" : k === r.target ? "border-2 border-green-600" : k === picked ? "border-2 border-red-500" : "btn-secondary"}`}>{w}</button>
        ))}
      </div>
      {picked !== null && (
        <div className="flex items-center gap-2" aria-live="polite">
          <span>{picked === r.target ? "✓ Right" : `It was “${r.pair[r.target]}”`}</span>
          <button className="btn btn-primary btn-sm ml-auto" onClick={() => { setPicked(null); setI(i + 1); }}>Next</button>
        </div>
      )}
      <p className="text-xs text-muted">Synthetic voices can blur some contrasts. If two words sound identical here, trust the explanation in Sounds.</p>
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
  const { play, playing } = usePlayer();
  if (!lines.length) return <p className="card text-muted">Shadowing lines come from your lesson dialogues. Start Day 1 first.</p>;
  const l = lines[i];
  return (
    <div className="card space-y-3">
      <Bi t={{ en: "Play the line, then say it at the same time as the voice (shadowing), copying rhythm and melody. Then record yourself alone and compare.", hi: "पंक्ति चलाइए, फिर आवाज़ के साथ-साथ बोलिए (shadowing), लय और सुर की नक़ल करते हुए। फिर अकेले रिकॉर्ड करके तुलना कीजिए।" }} className="text-sm" />
      <p className="text-xs text-muted">Line {i + 1} of {lines.length} · from Day {l.day}</p>
      <p className="text-xl" lang="fr">{l.fr}</p>
      <p className="text-sm text-muted">{l.en} · <span lang="hi" className="deva">{l.hi}</span></p>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={() => play([{ text: l.fr, voice: l.voice }], { slow })}>{playing !== null ? "Playing…" : "▶ Play"}</button>
        <button className="btn btn-secondary" onClick={async () => { for (let k = 0; k < 3; k++) { if (!(await play([{ text: l.fr, voice: l.voice }], { slow }))) break; await new Promise((r) => setTimeout(r, 1200)); } }}>🔁 Play 3× with pauses</button>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} /> Slow</label>
      </div>
      <Recorder model={l.fr} voice={l.voice} refKey={`shadow:${l.day}:${i}`} />
      <div className="flex gap-2">
        <button className="btn btn-secondary btn-sm" disabled={i === 0} onClick={() => setI(i - 1)}>← Previous</button>
        <button className="btn btn-secondary btn-sm" disabled={i >= lines.length - 1} onClick={() => setI(i + 1)}>Next →</button>
      </div>
    </div>
  );
}
