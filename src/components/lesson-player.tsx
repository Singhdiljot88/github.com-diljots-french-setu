"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ClientLesson } from "@/server/lesson-view";
import { api } from "@/lib/api-client";
import { ReportProblem } from "./report-problem";
import { BLOCK_LABELS, BLOCK_ORDER, type BlockKey } from "@/lib/schedule";
import { Bi, useBiLabel } from "./bi";
import { FrItem, Meaning, Pron } from "./fr-item";
import { AudioSourceNote, Speak, usePlayer } from "./audio";
import { Dictation, GapFill, McqLive, ResultLine } from "./exercises";
import { Recorder } from "./recorder";
import { TappableText } from "./tappable";
import { WritingEditor } from "./writing-editor";
import { AccentBar } from "./accent-bar";
import { HindiBridge } from "./hindi-bridge";
import { BRIDGE_DAYS } from "@/lib/hindi-bridges";
import type { AnswerCheck } from "@/lib/text";

type Props = { lesson: ClientLesson; activities: Record<string, boolean>; minutes: Record<BlockKey, number>; share: number; reviewStatus: string; dueCount: number };

const take = <T,>(arr: T[], share: number, min = 2) => (share >= 1 ? arr : arr.slice(0, Math.max(min, Math.ceil(arr.length * share))));

export function LessonPlayer({ lesson: d, activities: initial, minutes, share, reviewStatus, dueCount }: Props) {
  const [done, setDone] = useState<Record<string, boolean>>(initial);
  const [completed, setCompleted] = useState(BLOCK_ORDER.every((b) => initial[b]));
  const lastMark = useRef(Date.now());
  // Guided view shows one block at a time; the full lesson stays one tap away.
  const [guided, setGuided] = useState(true);
  const [step, setStep] = useState<BlockKey>(() => BLOCK_ORDER.find((b) => !initial[b]) ?? BLOCK_ORDER[0]);
  useEffect(() => { try { if (localStorage.getItem("lesson-view") === "full") setGuided(false); } catch { /* storage unavailable */ } }, []);
  const setView = (g: boolean) => { setGuided(g); try { localStorage.setItem("lesson-view", g ? "guided" : "full"); } catch { /* ignore */ } };
  const stepIndex = BLOCK_ORDER.indexOf(step);
  const go = (b: BlockKey) => { setStep(b); requestAnimationFrame(() => document.getElementById(b)?.scrollIntoView({ block: "start" })); };
  const shown = (b: BlockKey) => !guided || b === step;

  const mark = async (block: BlockKey) => {
    const elapsed = (Date.now() - lastMark.current) / 60000;
    const m = Math.round(Math.min(elapsed, Math.max(minutes[block], 5) * 1.5) * 10) / 10;
    lastMark.current = Date.now();
    const r = await api<{ activities: Record<string, boolean>; completed: boolean }>(`/api/lesson/${d.day}/block`, { body: { block, minutes: m } });
    setDone(r.activities);
    setCompleted(r.completed);
    const next = BLOCK_ORDER.slice(BLOCK_ORDER.indexOf(block) + 1).find((b) => !r.activities[b]);
    if (guided && next) go(next);
  };
  const gendered = [...d.vocabulary, ...d.phrases, ...d.grammar.examples].some((v) => /(ता|ते) (हूँ|है|हैं|हो)/.test(v.hi));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted"><Bi as="span" t={{ en: `Day ${d.day} · Phase ${d.phase}${d.light ? " · Lighter review day" : ""}${d.checkpoint ? " · Checkpoint" : ""}`, hi: `दिन ${d.day} · चरण ${d.phase}${d.light ? " · हल्का दोहराव वाला दिन" : ""}${d.checkpoint ? " · पड़ाव जाँच" : ""}` }} /></p>
        <h1 className="text-2xl font-bold" lang="fr">{d.title.fr}</h1>
        <Bi className="text-lg" as="p" t={d.title} />
        <div className="card surface-2">
          <p className="text-sm font-semibold"><Bi as="span" t={{ en: "In this lesson you will learn", hi: "इस पाठ में आप सीखेंगे" }} /></p>
          <Bi t={d.objective} />
          <p className="mt-2 text-sm font-semibold"><Bi as="span" t={{ en: "Before this lesson", hi: "इस पाठ से पहले" }} /></p>
          <Bi t={d.prerequisites.summary} className="text-sm" />
          {d.prerequisites.days.length > 0 && <p className="text-sm"><Bi as="span" t={{ en: "Builds on", hi: "इन पर आधारित:" }} /> {d.prerequisites.days.map((x, i) => <span key={x}>{i > 0 && ", "}<Link className="underline" href={`/lesson/${x}`}><Bi as="span" t={{ en: `Day ${x}`, hi: `दिन ${x}` }} /></Link></span>)}</p>}
          <Bi className="mt-2 text-sm text-muted" t={{ en: `Estimated time: ${Object.values(minutes).reduce((a, b) => a + b, 0)} minutes${share < 1 ? ` (shorter version: about ${Math.round(share * 100)}% of exercises)` : ""}.`, hi: `अनुमानित समय: ${Object.values(minutes).reduce((a, b) => a + b, 0)} मिनट${share < 1 ? ` (छोटा रूप: लगभग ${Math.round(share * 100)}% अभ्यास)` : ""}।` }} />
        </div>
        {d.mock && <p className="card border-brand-500/50"><Bi as="span" t={{ en: d.mock.part === "review" ? "This is a mock exam day. After the warm-up below, open this practice exam to review your results:" : "This is a mock exam day. After the warm-up below, open this practice exam:", hi: d.mock.part === "review" ? "आज अभ्यास परीक्षा का दिन है। नीचे का अभ्यास करने के बाद अपने परिणाम देखने के लिए यह परीक्षा खोलें:" : "आज अभ्यास परीक्षा का दिन है। नीचे का अभ्यास करने के बाद यह परीक्षा खोलें:" }} /> <Link className="font-semibold underline" href={`/exam?mock=${d.mock.id}&part=${d.mock.part}`}><Bi as="span" t={{ en: `TEF practice → ${d.mock.id.replace("mock-", "Practice exam ")}`, hi: `परीक्षा अभ्यास → ${d.mock.id.replace("mock-", "अभ्यास परीक्षा ")}` }} /></Link></p>}
        <ContentStatus status={reviewStatus} day={d.day} />
        <nav aria-label="Lesson sections" className="flex flex-wrap items-center gap-2">
          {BLOCK_ORDER.map((b, i) => <a key={b} href={`#${b}`} onClick={(e) => { if (guided) { e.preventDefault(); go(b); } }} aria-current={guided && b === step ? "step" : undefined} className={`chip border ${guided && b === step ? "border-brand-700 ring-2 ring-brand-500" : done[b] ? "border-brand-500 bg-brand-100 text-brand-900" : "border-app"}`}>{done[b] ? "✓ " : `${i + 1}. `}<Bi as="span" t={BLOCK_LABELS[b]} /></a>)}
          <button type="button" className="text-sm underline" onClick={() => setView(!guided)}>
            <Bi as="span" t={guided ? { en: "Show the full lesson", hi: "पूरा पाठ एक साथ दिखाएँ" } : { en: "One step at a time", hi: "एक बार में एक कदम" }} />
          </button>
        </nav>
      </header>

      <Section hidden={!shown("review")} id="review" minutes={minutes.review} done={done.review} onDone={() => mark("review")}>
        <p className="text-sm"><Bi as="span" t={{ en: `You have ${dueCount} cards due in your spaced review.`, hi: `आपके दोहराव में ${dueCount} कार्ड बाकी हैं।` }} /> <Link className="underline" href="/review"><Bi as="span" t={{ en: "Open review, then come back.", hi: "दोहराव खोलें, फिर यहाँ लौटें।" }} /></Link></p>
        <Bi className="mt-3 text-sm font-medium" t={{ en: "Quick recall from earlier days: say the meaning before revealing it.", hi: "पिछले दिनों से जल्दी याद करें: अर्थ देखने से पहले उसे बोलकर बताएँ।" }} />
        <ul className="mt-1 grid gap-2 sm:grid-cols-2">{d.review.items.map((it, i) => <RecallItem key={i} item={it} day={d.day} />)}</ul>
      </Section>

      <Section hidden={!shown("learn")} id="learn" minutes={minutes.learn} done={done.learn} onDone={() => mark("learn")} doneNote={{ en: "Marking this done adds today's words and phrases to your spaced review.", hi: "इसे पूर्ण चिह्नित करने पर आज के शब्द और वाक्यांश आपके दोहराव में जुड़ जाते हैं।" }}>
        <h3 className="font-semibold"><Bi as="span" t={{ en: "Vocabulary", hi: "शब्द" }} /></h3>
        <ul className="divide-y divide-[var(--border)]">{d.vocabulary.map((v, i) => <li key={i}><FrItem item={v} day={d.day} /></li>)}</ul>
        {gendered && <GenderNote />}
        <h3 className="mt-4 font-semibold"><Bi as="span" t={{ en: "Reusable phrases", hi: "काम आने वाले वाक्यांश" }} /></h3>
        <ul className="divide-y divide-[var(--border)]">{d.phrases.map((v, i) => <li key={i}><FrItem item={v} day={d.day} /></li>)}</ul>
        <div className="mt-4 rounded-xl border border-brand-500/40 p-4">
          <h3 className="font-semibold"><Bi as="span" t={d.grammar.title} /></h3>
          <Bi t={d.grammar.explanation} className="mt-2" />
          {BRIDGE_DAYS[d.day] && <HindiBridge topic={BRIDGE_DAYS[d.day]} className="mt-3" />}
          {d.grammar.comparison && <div className="mt-3 rounded-lg surface-2 p-3"><p className="text-xs font-semibold uppercase text-muted"><Bi as="span" t={{ en: "Compare with English and Hindi", hi: "अंग्रेज़ी और हिंदी से तुलना" }} /></p><Bi t={d.grammar.comparison} /></div>}
          <ul className="mt-3 divide-y divide-[var(--border)]">{d.grammar.examples.map((v, i) => <li key={i}><FrItem item={v} day={d.day} save={false} /></li>)}</ul>
          <p className="mt-3 text-xs font-semibold uppercase text-muted"><Bi as="span" t={{ en: "Watch out", hi: "ध्यान दें" }} /></p>
          <ul className="list-disc space-y-1 pl-5">{d.grammar.pitfalls.map((p, i) => <Bi key={i} as="li" t={p} />)}</ul>
        </div>
        <div className="mt-4 rounded-xl surface-2 p-4">
          <h3 className="font-semibold"><Bi as="span" t={{ en: "Pronunciation focus:", hi: "उच्चारण पर ध्यान:" }} /> {d.pronunciation.focus}</h3>
          <Bi t={d.pronunciation.tip} className="mt-1" />
          <ul className="mt-2 divide-y divide-[var(--border)]">{d.pronunciation.words.map((v, i) => <li key={i}><FrItem item={v} day={d.day} save={false} /></li>)}</ul>
          <Link href="/pronunciation" className="mt-2 inline-block text-sm underline"><Bi as="span" t={{ en: "More drills in the pronunciation lab", hi: "उच्चारण अभ्यास-कक्ष में और अभ्यास" }} /></Link>
        </div>
      </Section>

      <Section hidden={!shown("listening")} id="listening" minutes={minutes.listening} done={done.listening} onDone={() => mark("listening")}>
        <ListeningBlock d={d} share={share} />
      </Section>

      <Section hidden={!shown("speaking")} id="speaking" minutes={minutes.speaking} done={done.speaking} onDone={() => mark("speaking")}>
        <Bi t={d.speaking.instructions} />
        {d.speaking.focusSound && <p className="mt-1 text-sm"><Bi as="span" t={{ en: "Focus sound:", hi: "मुख्य ध्वनि:" }} /> <strong>{d.speaking.focusSound}</strong></p>}
        <ol className="mt-3 space-y-4">
          {take(d.speaking.prompts, share, 3).map((p, i) => (
            <li key={i} className="space-y-1">
              <FrItem item={p} day={d.day} save={false} compact />
              <Recorder model={p.model ?? p.fr.replace(/…|\.\.\./g, "")} refKey={`day:${d.day}:speaking:${i}`} compact />
            </li>
          ))}
        </ol>
        <Bi t={d.speaking.tip} className="mt-3 rounded-lg surface-2 p-3 text-sm" />
        {d.speaking.scenario && (
          <div className="mt-3 rounded-xl border border-app p-3">
            <p className="font-semibold"><Bi as="span" t={{ en: "Role-play", hi: "भूमिका अभ्यास" }} /></p>
            <Bi t={d.speaking.scenario.setting} className="text-sm" />
            <p className="mt-1 text-sm"><strong><Bi as="span" t={{ en: "You:", hi: "आप:" }} /></strong> <Bi as="span" t={d.speaking.scenario.learnerRole} /></p>
            <p className="text-sm"><strong><Bi as="span" t={{ en: "Partner:", hi: "साथी:" }} /></strong> <Bi as="span" t={d.speaking.scenario.partnerRole} /></p>
            <Link className="btn btn-primary btn-sm mt-2" href={`/speaking?scenario=day:${d.day}`}><Bi as="span" t={{ en: "Practise this with the speaking tutor", hi: "इसे बोलने वाले ट्यूटर के साथ अभ्यास करें" }} /></Link>
          </div>
        )}
      </Section>

      <Section hidden={!shown("reading")} id="reading" minutes={minutes.reading} done={done.reading} onDone={() => mark("reading")}>
        <ReadingBlock d={d} share={share} />
      </Section>

      <Section hidden={!shown("writing")} id="writing" minutes={minutes.writing} done={done.writing} onDone={() => mark("writing")}>
        <Bi t={d.writing.prompt} className="font-medium" />
        <Bi className="text-sm text-muted" t={{ en: `At least ${d.writing.minWords} words${d.writing.maxWords ? `, at most ${d.writing.maxWords}` : ""}.`, hi: `कम से कम ${d.writing.minWords} शब्द${d.writing.maxWords ? `, ज़्यादा से ज़्यादा ${d.writing.maxWords}` : ""}।` }} />
        <WritingEditor taskType={d.writing.type} taskRef={`day:${d.day}`} minWords={d.writing.minWords} maxWords={d.writing.maxWords} prompt={d.writing.prompt.fr ?? d.writing.prompt.en}
          learn={{ hints: d.writing.hints, phrases: d.writing.usefulPhrases, model: d.writing.model, checklist: d.writing.checklist }} defaultMode="practice" />
      </Section>

      <Section hidden={!shown("assessment")} id="assessment" minutes={minutes.assessment} done={done.assessment} onDone={() => mark("assessment")} requireNote={{ en: "Submit the check first.", hi: "पहले जाँच के उत्तर जमा करें।" }}>
        <AssessmentBlock d={d} onSubmitted={() => !done.assessment && mark("assessment")} />
      </Section>

      {completed && (
        <div className="card border-brand-500 bg-brand-50 text-center dark:bg-brand-900/30" role="status">
          <p className="text-xl font-bold"><Bi as="span" t={{ en: `Day ${d.day} complete`, hi: `दिन ${d.day} पूरा हुआ` }} /> 🎉</p>
          <Bi className="text-sm" t={{ en: "Finishing a lesson is recorded separately from mastery. Your answers today feed your skill progress.", hi: "पाठ पूरा करना और किसी कौशल में पक्का होना अलग-अलग दर्ज होते हैं। आज के आपके उत्तर आपकी कौशल प्रगति में जुड़ते हैं।" }} />
          {d.day < 120 && <Link href="/today" className="btn btn-primary mt-3"><Bi as="span" t={{ en: "Back to Today", hi: "आज के पेज पर लौटें" }} /></Link>}
          {d.checkpoint && <Link href={`/progress?checkpoint=${d.day}`} className="btn btn-secondary mt-3 ml-2"><Bi as="span" t={{ en: "See checkpoint report", hi: "पड़ाव रिपोर्ट देखें" }} /></Link>}
        </div>
      )}
    </div>
  );
}

function ContentStatus({ status, day }: { status: string; day: number }) {
  const label = status === "reviewed" ? { en: "Reviewed by an editor", hi: "संपादक ने जाँचा है" } : status === "in_review" ? { en: "In editorial review", hi: "संपादक जाँच रहे हैं" } : { en: "AI-drafted lesson, not yet reviewed by a human expert", hi: "AI से बना पाठ, अभी किसी विशेषज्ञ ने नहीं जाँचा" };
  return (
    <div className="text-xs text-muted">
      <Bi as="span" className="chip surface-2" t={label} />{" "}
      <ReportProblem target={`day:${day}`} />
    </div>
  );
}

type BiText = { en: string; hi: string };

function GenderNote() {
  return (
    <Bi className="mt-2 rounded-lg surface-2 p-3 text-sm" t={{
      en: "Hindi meanings here use the masculine form, such as करता हूँ. A woman says करती हूँ. French present-tense verbs such as je parle do not change for this, so the same French is right for everyone. Adjectives and some past forms do change in French, and the lesson says when.",
      hi: "यहाँ हिंदी अर्थ पुल्लिंग रूप में लिखे हैं, जैसे \"करता हूँ\"। महिलाएँ \"करती हूँ\" कहेंगी। फ़्रेंच में वर्तमान काल की क्रिया, जैसे je parle, इससे नहीं बदलती, इसलिए वही फ़्रेंच सबके लिए सही है। फ़्रेंच में विशेषण और कुछ भूतकाल रूप बदलते हैं, और पाठ में वहाँ यह बताया गया है।",
    }} />
  );
}

function Section({ id, hidden, minutes, done, onDone, children, doneNote, requireNote }: { id: BlockKey; hidden?: boolean; minutes: number; done?: boolean; onDone: () => Promise<void> | void; children: React.ReactNode; doneNote?: BiText; requireNote?: BiText }) {
  const [busy, setBusy] = useState(false);
  return (
    <section id={id} hidden={hidden} className="card scroll-mt-20" aria-labelledby={`${id}-h`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-h`} className="text-lg font-semibold"><Bi as="span" t={BLOCK_LABELS[id]} /></h2>
        <span className="text-sm text-muted"><Bi as="span" t={minutes > 0 ? { en: `${minutes} min`, hi: `${minutes} मिनट` } : { en: "optional today", hi: "आज ज़रूरी नहीं" }} />{done && " · ✓"}</span>
      </div>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-app pt-3">
        {done ? <span className="text-sm font-medium text-brand-700 dark:text-brand-200">✓ <Bi as="span" t={{ en: "Completed", hi: "पूरा हुआ" }} /></span> : (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={async () => { setBusy(true); try { await onDone(); } finally { setBusy(false); } }}><Bi as="span" t={{ en: `Mark ${BLOCK_LABELS[id].en.toLowerCase()} done`, hi: "पूर्ण चिह्नित करें" }} /></button>
        )}
        {doneNote && !done && <Bi as="span" className="text-xs text-muted" t={doneNote} />}
        {requireNote && !done && <Bi as="span" className="text-xs text-muted" t={requireNote} />}
      </div>
    </section>
  );
}

function RecallItem({ item, day }: { item: { fr: string; en: string; hi: string; pron?: string }; day: number }) {
  const [shown, setShown] = useState(false);
  return (
    <li className="rounded-lg border border-app p-2">
      <div className="flex items-center gap-2"><span lang="fr" className="fr">{item.fr}</span><Speak text={item.fr} showSlow={false} /></div>
      {shown ? <p className="text-sm"><Meaning en={item.en} hi={item.hi} /> <Pron pron={item.pron} day={day} /></p>
        : <button type="button" className="text-sm underline" onClick={() => setShown(true)}><Bi as="span" t={{ en: "Show meaning", hi: "अर्थ देखें" }} /></button>}
    </li>
  );
}

export function ListeningBlock({ d, share }: { d: ClientLesson; share: number }) {
  const L = d.listening;
  const { play, stop, playing, error } = usePlayer();
  const [answered, setAnswered] = useState(0);
  const [showScript, setShowScript] = useState(false);
  const qs = take(L.questions, share, 3);
  const lines = L.lines.map((l) => ({ text: l.fr, voice: l.voice }));
  const canReveal = answered >= qs.length;
  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium"><span lang="fr">{L.title.fr}</span> <Bi as="span" className="text-muted" t={L.title} /></p>
        <Bi t={L.context} className="text-sm text-muted" />
        <p className="mt-1 text-xs"><span className={`chip ${L.mode === "pedagogical" ? "bg-saffron-100 text-saffron-700" : "bg-brand-100 text-brand-900"}`}><Bi as="span" t={L.mode === "pedagogical" ? { en: "Teaching speed: deliberately slow and clear", hi: "सीखने की गति: जान-बूझकर धीमी और साफ़" } : { en: "Natural speed", hi: "सामान्य गति" }} /></span></p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => (playing !== null ? stop() : play(lines))}>{playing !== null ? <>■ <Bi as="span" t={{ en: "Stop", hi: "रोकें" }} /></> : <>▶ <Bi as="span" t={{ en: "Play the audio", hi: "ऑडियो सुनें" }} /></>}</button>
        <button type="button" className="btn btn-secondary" onClick={() => play(lines, { slow: true })}>🐢 <Bi as="span" t={{ en: "Play slowly", hi: "धीरे सुनें" }} /></button>
        {playing !== null && <span className="self-center text-sm text-muted" aria-live="polite"><Bi as="span" t={{ en: `Line ${playing + 1} of ${lines.length}`, hi: `पंक्ति ${playing + 1} / ${lines.length}` }} /></span>}
      </div>
      {error && <p role="alert" className="text-sm">{error}</p>}
      <AudioSourceNote />
      <Bi className="text-sm" t={{ en: "Listen first, answer the questions, then reveal the transcript.", hi: "पहले सुनें, प्रश्नों के उत्तर दें, फिर लिखा हुआ पाठ देखें।" }} />
      <div className="space-y-3">
        {qs.map((q, i) => <McqLive key={i} q={q} index={i} name={`l-${d.day}-${i}`} section="listening" endpoint={`/api/lesson/${d.day}/answer`} onAnswered={() => setAnswered((n) => n + 1)} />)}
      </div>
      <div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowScript((s) => !s)} disabled={!canReveal} aria-expanded={showScript}><Bi as="span" t={showScript ? { en: "Hide transcript", hi: "लिखा हुआ पाठ छिपाएँ" } : canReveal ? { en: "Show transcript and translation", hi: "लिखा हुआ पाठ और अनुवाद देखें" } : { en: `Transcript unlocks after the questions (${answered}/${qs.length})`, hi: `प्रश्नों के बाद लिखा हुआ पाठ खुलेगा (${answered}/${qs.length})` }} /></button>
        {showScript && (
          <ol className="mt-2 space-y-2">
            {L.lines.map((l, i) => (
              <li key={i} className={`rounded-lg p-2 ${playing === i ? "bg-brand-50 dark:bg-brand-900/40" : ""}`}>
                <p><span className="text-sm font-semibold">{l.speaker}:</span> <span lang="fr">{l.fr}</span> <Speak text={l.fr} voice={l.voice} /></p>
                <p className="text-sm text-muted"><Meaning en={l.en} hi={l.hi} /></p>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div><h3 className="font-semibold"><Bi as="span" t={{ en: "Dictation", hi: "श्रुतलेख" }} /></h3><Bi className="text-sm text-muted" t={{ en: "Listen and write exactly what you hear.", hi: "सुनें और ठीक वही लिखें जो आप सुनते हैं।" }} /><Dictation sentences={L.dictation} day={d.day} /></div>
      <div><h3 className="font-semibold"><Bi as="span" t={{ en: "Missing words", hi: "छूटे हुए शब्द" }} /></h3><Bi className="text-sm text-muted" t={{ en: "Fill the gaps from the dialogue.", hi: "बातचीत से खाली जगहें भरें।" }} /><GapFill text={L.gapFill.text} answers={L.gapFill.answers} day={d.day} /></div>
    </div>
  );
}

export function ReadingBlock({ d, share }: { d: ClientLesson; share: number }) {
  const R = d.reading;
  const [answered, setAnswered] = useState(0);
  const [showT, setShowT] = useState(false);
  const qs = take(R.questions, share, 3);
  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wide text-muted">{R.genre}</p>
      <div className="rounded-xl surface-2 p-4"><p className="mb-2 font-semibold" lang="fr">{R.title}</p><TappableText text={R.text} sourceRef={`day:${d.day}:reading`} /></div>
      {qs.map((q, i) => <McqLive key={i} q={q} index={i} name={`r-${d.day}-${i}`} section="reading" endpoint={`/api/lesson/${d.day}/answer`} onAnswered={() => setAnswered((n) => n + 1)} />)}
      <button type="button" className="btn btn-secondary btn-sm" disabled={answered < qs.length} onClick={() => setShowT((s) => !s)}><Bi as="span" t={answered < qs.length ? { en: `Translation unlocks after the questions (${answered}/${qs.length})`, hi: `प्रश्नों के बाद अनुवाद खुलेगा (${answered}/${qs.length})` } : showT ? { en: "Hide translation", hi: "अनुवाद छिपाएँ" } : { en: "Show translation", hi: "अनुवाद देखें" }} /></button>
      {showT && <Bi as="div" className="whitespace-pre-wrap text-sm" t={R.translation} />}
    </div>
  );
}

type AResult = { score: number; results: (AnswerCheck & { explanation: { en: string; hi: string } })[] };

function AssessmentBlock({ d, onSubmitted }: { d: ClientLesson; onSubmitted: () => void }) {
  const [resp, setResp] = useState<(string | number | null)[]>(d.assessment.map(() => null));
  const [res, setRes] = useState<AResult | null>(null);
  const [busy, setBusy] = useState(false);
  const label = useBiLabel();
  const set = (i: number, v: string | number) => setResp((r) => r.map((x, j) => (j === i ? v : x)));
  const submit = async () => {
    setBusy(true);
    try { const r = await api<AResult>(`/api/lesson/${d.day}/assessment`, { body: { responses: resp } }); setRes(r); onSubmitted(); } finally { setBusy(false); }
  };
  useEffect(() => { if (res) document.getElementById("assessment-result")?.focus(); }, [res]);
  return (
    <div className="space-y-4">
      <Bi className="text-sm text-muted" t={{ en: "Answer everything first. Answers and explanations appear after you submit.", hi: "पहले सभी प्रश्नों के उत्तर दें। जमा करने के बाद सही उत्तर और समझाइश दिखेंगे।" }} />
      {d.assessment.map((q, i) => (
        <fieldset key={i} className="rounded-xl border border-app p-3">
          <legend className="px-1 font-medium">{i + 1}. <Bi as="span" t={q.prompt} /></legend>
          {q.type === "mcq" && <div className="mt-2 grid gap-2">{q.options.map((o, j) => (
            <label key={j} className={`flex cursor-pointer gap-2 rounded-lg border p-2 ${resp[i] === j ? "border-brand-500" : "border-app"}`}><input type="radio" name={`a-${i}`} checked={resp[i] === j} disabled={!!res} onChange={() => set(i, j)} /><span lang="fr">{o}</span></label>
          ))}</div>}
          {q.type === "fill" && <><p lang="fr" className="mt-2">{q.sentence.replace("___", "_____")}</p><input lang="fr" className="input mt-1" aria-label={label({ en: "Your answer", hi: "आपका उत्तर" })} value={(resp[i] as string) ?? ""} disabled={!!res} onChange={(e) => set(i, e.target.value)} /></>}
          {q.type === "translate" && <><Bi className="mt-2" t={q.source} /><input lang="fr" className="input mt-1" aria-label={label({ en: "Your French translation", hi: "आपका फ़्रेंच अनुवाद" })} value={(resp[i] as string) ?? ""} disabled={!!res} onChange={(e) => set(i, e.target.value)} /></>}
          {q.type === "reorder" && <Reorder words={q.words} disabled={!!res} onChange={(v) => set(i, v)} />}
          {res && (
            <div className="mt-2 rounded-lg surface-2 p-2 text-sm">
              <ResultLine r={res.results[i]} />
              <Bi t={res.results[i].explanation} />
            </div>
          )}
        </fieldset>
      ))}
      {(d.assessment.some((q) => q.type !== "mcq")) && !res && <AccentBar />}
      {!res ? <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}><Bi as="span" t={busy ? { en: "Checking…", hi: "जाँच हो रही है…" } : { en: "Submit answers", hi: "उत्तर जमा करें" }} /></button> : (
        <div id="assessment-result" tabIndex={-1} className="rounded-xl bg-brand-50 p-3 dark:bg-brand-900/30" role="status">
          <p className="font-semibold"><Bi as="span" t={{ en: `Score: ${Math.round(res.score * 100)}%`, hi: `अंक: ${Math.round(res.score * 100)}%` }} /></p>
          <Bi className="text-sm" t={res.score < 0.6
            ? { en: "Mistakes were added to your mistake notebook as practice exercises. Re-read the grammar box and try again tomorrow. That is normal.", hi: "ग़लतियाँ आपकी ग़लतियों की कॉपी में अभ्यास के रूप में जुड़ गई हैं। व्याकरण वाला हिस्सा दोबारा पढ़ें और कल फिर कोशिश करें। ऐसा होना सामान्य है।" }
            : { en: "Mistakes were added to your mistake notebook as practice exercises. Well done.", hi: "ग़लतियाँ आपकी ग़लतियों की कॉपी में अभ्यास के रूप में जुड़ गई हैं। बहुत अच्छा।" }} />
          <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => { setRes(null); setResp(d.assessment.map(() => null)); }}><Bi as="span" t={{ en: "Try again", hi: "फिर से कोशिश करें" }} /></button>
        </div>
      )}
    </div>
  );
}

function Reorder({ words, disabled, onChange }: { words: string[]; disabled: boolean; onChange: (v: string) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const update = (p: number[]) => { setPicked(p); onChange(p.map((i) => words[i]).join(" ").replace(/\s+([?!.,])/g, " $1").replace(/ \./g, ".").replace(/ ,/g, ",")); };
  return (
    <div className="mt-2 space-y-2">
      <p className="min-h-10 rounded-lg border border-dashed border-app p-2" lang="fr" aria-live="polite">{picked.map((i) => words[i]).join(" ") || <Bi as="span" className="text-muted" t={{ en: "Tap the words in order", hi: "शब्दों को सही क्रम में दबाएँ" }} />}</p>
      <div className="flex flex-wrap gap-2">
        {words.map((w, i) => <button key={i} type="button" lang="fr" disabled={disabled || picked.includes(i)} className="btn btn-secondary btn-sm" onClick={() => update([...picked, i])}>{w}</button>)}
        {picked.length > 0 && !disabled && <button type="button" className="btn btn-ghost btn-sm" onClick={() => update([])}><Bi as="span" t={{ en: "Clear", hi: "मिटाएँ" }} /></button>}
      </div>
    </div>
  );
}
