import { PronunciationContent } from "./pronunciation-schema";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Day } from "./schema";
import { DictEntry } from "./dictionary-schema";
import { Mock } from "./mock-schema";

export const CURRICULUM_VERSION = "v1";
export const DICTIONARY_VERSION = "v1";
export const DICTIONARY_SOURCE = "French Setu seed dictionary v1 — AI-drafted, editorial review pending";

const contentDir = () => process.env.CONTENT_DIR ?? path.join(process.cwd(), "content");

export const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

function readJsonDir(sub: string) {
  const dir = path.join(contentDir(), sub);
  if (!fs.existsSync(dir)) return [] as { file: string; raw: string }[];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => ({ file: f, raw: fs.readFileSync(path.join(dir, f), "utf8") }));
}

export function loadDaysFromDisk() {
  const out: { day: Day; hash: string }[] = [];
  for (const { file, raw } of readJsonDir("days")) {
    const r = Day.safeParse(JSON.parse(raw));
    if (!r.success) {
      console.warn(`[content] skipping invalid ${file}: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`);
      continue;
    }
    out.push({ day: r.data, hash: sha(raw) });
  }
  return out.sort((a, b) => a.day.day - b.day.day);
}

export const entryId = (lemma: string, pos: string) => `${lemma.toLowerCase().normalize("NFC")}|${pos}`;

export function loadDictionaryFromDisk() {
  const map = new Map<string, DictEntry>();
  let hashInput = "";
  for (const { file, raw } of readJsonDir("dictionary")) {
    hashInput += raw;
    const arr = JSON.parse(raw) as unknown[];
    for (const e of arr) {
      const r = DictEntry.safeParse(e);
      if (!r.success) { console.warn(`[content] skipping invalid dictionary entry in ${file}: ${(e as { lemma?: string }).lemma}`); continue; }
      const id = entryId(r.data.lemma, r.data.pos);
      if (!map.has(id)) map.set(id, r.data);
    }
  }
  return { entries: [...map.entries()].map(([id, e]) => ({ id, entry: e })), hash: sha(hashInput) };
}

export function loadMocksFromDisk() {
  return readJsonDir("mocks").flatMap(({ file, raw }) => {
    const r = Mock.safeParse(JSON.parse(raw));
    if (!r.success) { console.warn(`[content] skipping invalid mock ${file}`); return []; }
    return [r.data];
  });
}

export function loadPronunciationFromDisk() {
  const raw = fs.readFileSync(path.join(contentDir(), "pronunciation.json"), "utf8");
  return PronunciationContent.parse(JSON.parse(raw));
}
