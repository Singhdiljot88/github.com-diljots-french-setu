"use client";
import { useEffect, useRef, useState } from "react";
import { usePrefs } from "./prefs";
import { usePlayer, AudioError, type VoiceKey } from "./audio";
import { Bi, useBiLabel } from "./bi";

export type RecorderState = "idle" | "explain" | "requesting" | "denied" | "unsupported" | "recording" | "recorded" | "error";

/**
 * Records the learner's voice for self-comparison. Audio stays in this tab
 * (object URL) unless the learner opted in to keeping recordings.
 */
export function Recorder({ model, voice, refKey, onRecorded, compact = false }: { model?: string; voice?: VoiceKey; refKey: string; onRecorded?: (blob: Blob) => void; compact?: boolean }) {
  const { micOptIn, keepRecordings } = usePrefs();
  const [state, setState] = useState<RecorderState>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [saved, setSaved] = useState<"no" | "saving" | "yes" | "error">("no");
  const [secs, setSecs] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { play, error: audioError } = usePlayer();
  const label = useBiLabel();

  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); if (url) URL.revokeObjectURL(url); if (timer.current) clearInterval(timer.current); }, [url]);

  const start = async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setState("unsupported"); return; }
    if (!micOptIn && state !== "explain") { setState("explain"); return; }
    setState("requesting");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      setState((e as DOMException).name === "NotAllowedError" || (e as DOMException).name === "SecurityError" ? "denied" : "error");
      return;
    }
    const mr = new MediaRecorder(stream.current);
    const chunks: BlobPart[] = [];
    mr.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    mr.onstop = () => {
      const b = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
      stream.current?.getTracks().forEach((t) => t.stop());
      if (url) URL.revokeObjectURL(url);
      setUrl(URL.createObjectURL(b)); setBlob(b); setSaved("no");
      setState("recorded");
      onRecorded?.(b);
    };
    rec.current = mr;
    mr.start();
    setSecs(0);
    timer.current = setInterval(() => setSecs((s) => { if (s >= 59) { mr.state === "recording" && mr.stop(); } return s + 1; }), 1000);
    setState("recording");
  };
  const stop = () => { if (timer.current) clearInterval(timer.current); rec.current?.state === "recording" && rec.current.stop(); };
  const discard = () => { if (url) URL.revokeObjectURL(url); setUrl(null); setBlob(null); setState("idle"); };
  const keep = async () => {
    if (!blob) return;
    setSaved("saving");
    const fd = new FormData(); fd.append("audio", blob); fd.append("ref", refKey); fd.append("kind", "practice");
    const r = await fetch("/api/recordings", { method: "POST", body: fd });
    setSaved(r.ok ? "yes" : "error");
  };

  return (
    <div className={`space-y-2 ${compact ? "" : "rounded-xl surface-2 p-3"}`}>
      <AudioError error={audioError} />
      {state === "explain" && (
        <div className="rounded-lg border border-app bg-[var(--surface)] p-3 text-sm" role="dialog" aria-label={label({ en: "About the microphone", hi: "माइक्रोफ़ोन के बारे में" })}>
          <Bi className="font-medium" t={{ en: "Before you record", hi: "रिकॉर्ड करने से पहले" }} />
          <Bi t={{ en: "Your browser will ask to use the microphone. The recording stays in this tab for you to replay and compare. It is not uploaded unless you press “Keep in my account” or ask for transcription.", hi: "ब्राउज़र माइक्रोफ़ोन इस्तेमाल करने की अनुमति माँगेगा। रिकॉर्डिंग सिर्फ़ इसी टैब में रहती है, ताकि आप उसे दोबारा सुनकर तुलना कर सकें। जब तक आप “मेरे खाते में रखें” न दबाएँ या लिखित रूप न माँगें, यह कहीं अपलोड नहीं होती।" }} />
          <div className="mt-2 flex gap-2"><button type="button" className="btn btn-primary btn-sm" onClick={start}>{label({ en: "Allow and record", hi: "अनुमति दें और रिकॉर्ड करें" })}</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => setState("idle")}>{label({ en: "Not now", hi: "अभी नहीं" })}</button></div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {model && <button type="button" className="btn btn-secondary btn-sm" onClick={() => play([{ text: model, voice }])}>▶ {label({ en: "Model", hi: "नमूना सुनें" })}</button>}
        {state !== "recording"
          ? <button type="button" className="btn btn-primary btn-sm" onClick={start} disabled={state === "requesting"}>● {state === "recorded" ? label({ en: "Record again", hi: "फिर से रिकॉर्ड करें" }) : label({ en: "Record", hi: "रिकॉर्ड करें" })}</button>
          : <button type="button" className="btn btn-primary btn-sm" onClick={stop}>■ {label({ en: `Stop (${secs}s)`, hi: `रोकें (${secs} सेकंड)` })}</button>}
        {url && <audio controls src={url} className="h-9 max-w-full" aria-label={label({ en: "Your recording", hi: "आपकी रिकॉर्डिंग" })} />}
        {url && model && <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { await play([{ text: model, voice }]); const a = new Audio(url); await a.play(); }}>⇄ {label({ en: "Compare", hi: "तुलना करें" })}</button>}
        {url && <button type="button" className="btn btn-ghost btn-sm" onClick={discard}>{label({ en: "Delete", hi: "हटाएँ" })}</button>}
        {url && keepRecordings && saved !== "yes" && <button type="button" className="btn btn-ghost btn-sm" onClick={keep} disabled={saved === "saving"}>{label({ en: "Keep in my account", hi: "मेरे खाते में रखें" })}</button>}
        {saved === "yes" && <Bi as="span" className="text-xs text-muted" t={{ en: "Saved. Manage recordings in Settings.", hi: "सहेजा गया। रिकॉर्डिंग सेटिंग्स में सँभालें।" }} />}
      </div>
      {state === "recording" && <p className="text-sm" aria-live="polite">{label({ en: "Recording… speak now.", hi: "रिकॉर्डिंग हो रही है… अब बोलें।" })}</p>}
      {state === "denied" && <p role="alert" className="text-sm"><Bi as="span" t={{ en: "The browser hasn't been allowed to use the microphone. To record, allow the microphone for this site in your browser settings (usually the lock icon in the address bar), then try again. You can still listen, repeat aloud and compare yourself without recording.", hi: "ब्राउज़र को माइक्रोफ़ोन इस्तेमाल करने की अनुमति नहीं मिली है। रिकॉर्ड करने के लिए ब्राउज़र की सेटिंग्स में इस साइट के लिए माइक्रोफ़ोन की अनुमति दें (अक्सर पता-पट्टी में ताले वाला निशान), फिर दोबारा कोशिश करें। रिकॉर्ड किए बिना भी आप सुन सकते हैं, ज़ोर से दोहरा सकते हैं और ख़ुद तुलना कर सकते हैं।" }} /></p>}
      {state === "unsupported" && <p role="alert" className="text-sm"><Bi as="span" t={{ en: "This browser can't record audio. Try a recent Chrome, Edge, Firefox or Safari. You can still repeat aloud after the model.", hi: "यह ब्राउज़र ऑडियो रिकॉर्ड नहीं कर सकता। Chrome, Edge, Firefox या Safari का नया संस्करण आज़माएँ। तब तक आप नमूने के बाद ज़ोर से दोहरा सकते हैं।" }} /></p>}
      {state === "error" && <p role="alert" className="text-sm"><Bi as="span" t={{ en: "The microphone couldn't be started. Check that one is connected and not being used by another app, then try again.", hi: "माइक्रोफ़ोन शुरू नहीं हो सका। देख लें कि माइक जुड़ा है और कोई दूसरा ऐप उसे इस्तेमाल नहीं कर रहा, फिर दोबारा कोशिश करें।" }} /></p>}
      {state === "recorded" && !compact && <Bi className="text-xs text-muted" t={{ en: "Self-comparison only: listen for vowel quality, nasal vowels, the French r and rhythm. This is not an automatic pronunciation score.", hi: "यह सिर्फ़ ख़ुद तुलना करने के लिए है: स्वरों की गुणवत्ता, नाक से बोले जाने वाले स्वर, फ़्रेंच r और लय पर ध्यान दें। यह उच्चारण के लिए कोई अपने-आप दिया गया अंक नहीं है।" }} />}
    </div>
  );
}
