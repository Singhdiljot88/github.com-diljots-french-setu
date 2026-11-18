import Link from "next/link";

export const metadata = { title: "Privacy" };

/**
 * Plain-language description of how the app actually handles data, kept in step with the code.
 * DRAFT: have it reviewed (and add the operator's legal name and contact) before a paid launch.
 */
const SECTIONS: { h: string; hi: string; body: string[] }[] = [
  { h: "What we store", hi: "हम क्या रखते हैं", body: [
    "Your account: email address and a password stored only as a salted scrypt hash. Guest accounts have no email.",
    "Your learning: your plan settings, lesson progress, answers, scores, mistakes, saved words, writing you submit for feedback and study minutes.",
    "Recordings: only if you turn on “Keep my recordings” in Settings. Otherwise recordings are played back in your browser and never stored.",
  ] },
  { h: "What is sent to other services", hi: "दूसरी सेवाओं को क्या भेजा जाता है", body: [
    "When you use an AI feature (the tutor, writing feedback, speaking partner, Hindi → French), the text you enter and the lesson context are sent to OpenAI. The server reads the existing variable OPENAI_API_KEY. That key never goes to your browser. If the variable is empty, these features stay in labelled demo mode and the text is not sent.",
    "When you use server speech recognition, your recording is sent to the speech provider for transcription and then discarded. With OPENAI_API_KEY set and speech left on its default, that provider is OpenAI. Set STT_PROVIDER=browser to keep recognition on the device. Server text-to-speech sends the French text only, and only if a server voice is configured.",
    "Without these services configured, the app runs in a labelled demo mode and nothing is sent.",
  ] },
  { h: "Cookies", hi: "कुकीज़", body: ["One sign-in cookie (fs_session) keeps you logged in. There are no advertising or analytics cookies."] },
  { h: "Your control", hi: "आपका नियंत्रण", body: [
    "Settings → Download my data gives you everything we hold about you as a JSON file.",
    "Settings → Delete my account permanently deletes your account and all its data. Kept recordings can be deleted one by one or all at once.",
  ] },
  { h: "Results", hi: "नतीजे", body: ["Practice scores in this app are not official TEF, TCF, CEFR or NCLC results and are never presented as such."] },
];

export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Link href="/" className="text-sm underline">← French Setu</Link>
      <header>
        <h1 className="text-3xl font-bold">Privacy · <span lang="hi" className="deva">गोपनीयता</span></h1>
        <p className="text-sm text-muted">How French Setu handles your data, in plain language. Last updated 18 November 2026.</p>
      </header>
      {SECTIONS.map((s) => (
        <section key={s.h} className="card space-y-2">
          <h2 className="font-semibold">{s.h} · <span lang="hi" className="deva">{s.hi}</span></h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{s.body.map((b) => <li key={b}>{b}</li>)}</ul>
        </section>
      ))}
    </main>
  );
}
