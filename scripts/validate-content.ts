/**
 * Validates curriculum, dictionary and mock-exam content.
 * Usage: npx tsx scripts/validate-content.ts [file ...]
 * With no arguments, validates everything under content/.
 */
import fs from "node:fs";
import path from "node:path";
import { Day } from "../src/content/schema";
import { DictEntry } from "../src/content/dictionary-schema";
import { Mock } from "../src/content/mock-schema";
import { PronunciationContent } from "../src/content/pronunciation-schema";
import { OUTLINE, isLightDay, isCheckpointDay, phaseOf, MOCK_DAYS } from "../src/content/outline";
import { lintDay, lintDictionary, lintMock } from "../src/content/lint";

const root = path.resolve(__dirname, "..", "content");
let args = process.argv.slice(2);
if (args.length === 0) {
  const ls = (d: string) => fs.existsSync(path.join(root, d)) ? fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith(".json")).map((f) => path.join(root, d, f)) : [];
  args = [...ls("days"), ...ls("dictionary"), ...ls("mocks"), path.join(root, "pronunciation.json")];
}

let errors = 0;
const fail = (file: string, msg: string) => { errors++; console.error(`✗ ${path.relative(process.cwd(), file)}: ${msg}`); };

for (const file of args) {
  const before = errors;
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { fail(file, `invalid JSON: ${(e as Error).message}`); continue; }
  const kind = file.includes(`${path.sep}days${path.sep}`) || /day-\d+\.json$/.test(file) ? "day" : file.includes("mock") ? "mock" : path.basename(file) === "pronunciation.json" ? "pron" : "dict";
  if (kind === "day") {
    const r = Day.safeParse(raw);
    if (!r.success) { for (const i of r.error.issues.slice(0, 25)) fail(file, `${i.path.join(".")}: ${i.message}`); continue; }
    const d = r.data;
    const expected = Number(path.basename(file).match(/(\d+)/)?.[1]);
    if (d.day !== expected) fail(file, `day ${d.day} does not match filename`);
    if (d.phase !== phaseOf(d.day)) fail(file, `phase should be ${phaseOf(d.day)}`);
    if (d.light !== isLightDay(d.day)) fail(file, `light should be ${isLightDay(d.day)}`);
    if (d.checkpoint !== isCheckpointDay(d.day)) fail(file, `checkpoint should be ${isCheckpointDay(d.day)}`);
    const m = MOCK_DAYS[d.day];
    if (m && (!d.mock || d.mock.id !== m.id || d.mock.part !== m.part)) fail(file, `mock should be ${JSON.stringify(m)}`);
    if (!OUTLINE.find((o) => o.day === d.day)) fail(file, "not in outline");
    for (const w of lintDay(d)) fail(file, w);
    if (errors === before) console.log(`✓ day ${d.day}`);
  } else if (kind === "pron") {
    const r = PronunciationContent.safeParse(raw);
    if (!r.success) { for (const i of r.error.issues.slice(0, 25)) fail(file, `${i.path.join(".")}: ${i.message}`); continue; }
    for (const s of r.data.sounds) for (const e of s.examples) if (/[a-zA-Z]/.test(e.pron.replace(/[üö]/g, ""))) fail(file, `${s.id}: Latin letters in pron "${e.pron}"`);
    console.log(`✓ pronunciation: ${r.data.sounds.length} sounds, ${r.data.minimalPairs.length} minimal-pair sets`);
  } else if (kind === "mock") {
    const r = Mock.safeParse(raw);
    if (!r.success) { for (const i of r.error.issues.slice(0, 25)) fail(file, `${i.path.join(".")}: ${i.message}`); continue; }
    for (const w of lintMock(r.data)) fail(file, w);
    console.log(`✓ ${r.data.id}`);
  } else {
    if (!Array.isArray(raw)) { fail(file, "dictionary file must be a JSON array"); continue; }
    const ok: DictEntry[] = [];
    raw.forEach((e, i) => {
      const r = DictEntry.safeParse(e);
      if (!r.success) for (const iss of r.error.issues.slice(0, 5)) fail(file, `[${i}] ${(e as { lemma?: string })?.lemma ?? "?"} ${iss.path.join(".")}: ${iss.message}`);
      else ok.push(r.data);
    });
    for (const w of lintDictionary(ok)) fail(file, w);
    console.log(`✓ ${path.basename(file)}: ${ok.length} entries`);
  }
}
console.log(errors ? `\n${errors} problem(s) found` : "\nAll content valid");
process.exit(errors ? 1 : 0);
