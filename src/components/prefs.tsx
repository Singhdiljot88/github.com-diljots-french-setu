"use client";
import { createContext, useContext } from "react";
import type { Scaffold } from "@/lib/schedule";

export type ClientPrefs = {
  explanationLang: "en" | "hi" | "both";
  devanagariMode: "auto" | "always" | "never";
  showIpa: boolean;
  slowAudioDefault: boolean;
  micOptIn: boolean;
  keepRecordings: boolean;
  timezone: string;
  /** Course day the learner is on (drives default pronunciation scaffolding) */
  courseDay: number;
  providers: ProviderStatus;
};

export type ProviderStatus = {
  ai: { available: boolean; name: string };
  tts: { server: boolean; name: string };
  stt: { server: boolean; name: string };
  pronunciation: { available: boolean; name: string };
  search: { available: boolean; name: string };
};

export const defaultPrefs: ClientPrefs = {
  explanationLang: "both", devanagariMode: "auto", showIpa: false, slowAudioDefault: true, micOptIn: false, keepRecordings: false, timezone: "UTC", courseDay: 1,
  providers: { ai: { available: false, name: "demo" }, tts: { server: false, name: "device" }, stt: { server: false, name: "browser" }, pronunciation: { available: false, name: "none" }, search: { available: false, name: "none" } },
};

const Ctx = createContext<ClientPrefs>(defaultPrefs);
export const PrefsProvider = ({ value, children }: { value: ClientPrefs; children: React.ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const usePrefs = () => useContext(Ctx);

/** Scaffolding level for the day being viewed. */
export function useScaffold(day?: number, examPractice = false): Scaffold {
  const p = usePrefs();
  const d = day ?? p.courseDay;
  if (p.devanagariMode === "always") return "visible";
  if (p.devanagariMode === "never") return "off";
  if (d <= 30) return "visible";
  if (d <= 60) return "collapsible";
  if (d <= 90) return "audio_first";
  return examPractice ? "off" : "audio_first";
}
