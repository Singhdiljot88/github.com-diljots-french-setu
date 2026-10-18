import { addDays, diffDays } from "./dates";
import { isLightDay } from "@/content/outline";

export type BlockKey = "review" | "learn" | "listening" | "speaking" | "reading" | "writing" | "assessment";
export const BLOCK_ORDER: BlockKey[] = ["review", "learn", "listening", "speaking", "reading", "writing", "assessment"];

export const BLOCK_LABELS: Record<BlockKey, { en: string; hi: string }> = {
  review: { en: "Spaced review", hi: "दोहराई (स्पेस्ड रिव्यू)" },
  learn: { en: "New vocabulary and grammar", hi: "नए शब्द और व्याकरण" },
  listening: { en: "Listening", hi: "सुनना" },
  speaking: { en: "Speaking and pronunciation", hi: "बोलना और उच्चारण" },
  reading: { en: "Reading", hi: "पढ़ना" },
  writing: { en: "Writing", hi: "लिखना" },
  assessment: { en: "Correction and assessment", hi: "सुधार और मूल्यांकन" },
};

export type DailyMinutes = 45 | 90 | 150 | 180;
export type Pace = "compact" | "complete";

/** Minutes per block. 150 is the recommended intensive plan from the course design. */
const PLANS: Record<DailyMinutes, Record<BlockKey, number>> = {
  150: { review: 15, learn: 20, listening: 25, speaking: 25, reading: 20, writing: 25, assessment: 20 },
  180: { review: 20, learn: 25, listening: 30, speaking: 30, reading: 25, writing: 30, assessment: 20 },
  90: { review: 10, learn: 15, listening: 15, speaking: 15, reading: 10, writing: 10, assessment: 15 },
  45: { review: 7, learn: 10, listening: 8, speaking: 8, reading: 5, writing: 0, assessment: 7 },
};

/** Every seventh day: lighter on new material, heavier on review. Same total. */
const LIGHT_150: Record<BlockKey, number> = { review: 40, learn: 5, listening: 20, speaking: 25, reading: 15, writing: 20, assessment: 25 };

export function blockMinutes(day: number, minutes: DailyMinutes, pace: Pace): Record<BlockKey, number> {
  const base = pace === "complete" ? PLANS[150] : PLANS[minutes];
  if (!isLightDay(day)) return { ...base };
  const scale = (pace === "complete" ? 150 : minutes) / 150;
  const out = {} as Record<BlockKey, number>;
  for (const k of BLOCK_ORDER) out[k] = Math.round(LIGHT_150[k] * scale);
  return out;
}

/**
 * In "complete" pace a lesson is done in full and may span several calendar days
 * when daily time is short. In "compact" pace one lesson fits each day with
 * trimmed activity sets.
 */
export function partsPerLesson(minutes: DailyMinutes, pace: Pace): number {
  if (pace === "compact") return 1;
  return minutes >= 150 ? 1 : minutes === 90 ? 2 : 4;
}

const PART_BLOCKS: Record<number, BlockKey[][]> = {
  1: [BLOCK_ORDER],
  2: [["review", "learn", "listening", "speaking"], ["review", "reading", "writing", "assessment"]],
  4: [["review", "learn"], ["review", "listening"], ["speaking", "reading"], ["writing", "assessment"]],
};

export function blocksForPart(parts: number, part: number): BlockKey[] {
  return PART_BLOCKS[parts][part - 1];
}

/** How much of each activity set is assigned in compact mode with short sessions. */
export function itemShare(minutes: DailyMinutes, pace: Pace): number {
  if (pace === "complete") return 1;
  return minutes >= 150 ? 1 : minutes === 90 ? 0.6 : 0.35;
}

export type ScheduleInput = {
  startDate: string;
  dailyMinutes: DailyMinutes;
  pace: Pace;
  scheduleShiftDays: number;
  placementDay: number;
  examDate?: string | null;
};

export type ScheduledSlot = { courseDay: number; part: number; parts: number; beforeStart: boolean; finished: boolean };

/** Which lesson (and part) is scheduled on a given local date. */
export function slotForDate(s: ScheduleInput, date: string): ScheduledSlot {
  const parts = partsPerLesson(s.dailyMinutes, s.pace);
  const elapsed = diffDays(s.startDate, date) - s.scheduleShiftDays;
  if (elapsed < 0) return { courseDay: s.placementDay, part: 1, parts, beforeStart: true, finished: false };
  const lessonIndex = Math.floor(elapsed / parts);
  const courseDay = s.placementDay + lessonIndex;
  if (courseDay > 120) return { courseDay: 120, part: parts, parts, beforeStart: false, finished: true };
  return { courseDay, part: (elapsed % parts) + 1, parts, beforeStart: false, finished: false };
}

/** Local date on which a given course day is scheduled (first part). */
export function dateForDay(s: ScheduleInput, courseDay: number): string {
  const parts = partsPerLesson(s.dailyMinutes, s.pace);
  return addDays(s.startDate, (courseDay - s.placementDay) * parts + s.scheduleShiftDays);
}

export function courseEndDate(s: ScheduleInput): string {
  const parts = partsPerLesson(s.dailyMinutes, s.pace);
  return addDays(dateForDay(s, 120), parts - 1);
}

export type RecoveryPlan = {
  behindBy: number;
  currentDay: number;
  scheduledDay: number;
  options: { key: "catch_up" | "shift"; en: string; hi: string }[];
  examWarning?: { en: string; hi: string };
};

/**
 * Builds a manageable, non-punitive recovery plan when the learner is behind.
 * `nextIncompleteDay` is the first lesson the learner has not completed.
 */
export function recoveryPlan(s: ScheduleInput, today: string, nextIncompleteDay: number): RecoveryPlan | null {
  const slot = slotForDate(s, today);
  if (slot.beforeStart) return null;
  const scheduledDay = slot.finished ? 121 : slot.courseDay;
  const behindBy = scheduledDay - nextIncompleteDay;
  if (behindBy < 2) return null; // one day behind is normal: today's lesson is the next one
  const parts = partsPerLesson(s.dailyMinutes, s.pace);
  const options: RecoveryPlan["options"] = [
    {
      key: "catch_up",
      en: `Continue with Day ${nextIncompleteDay}. Each day, do that lesson plus a 10-minute review of the key words from the days you missed, until you are back on track.`,
      hi: `दिन ${nextIncompleteDay} से आगे बढ़िए। हर दिन वह पाठ कीजिए और छूटे हुए दिनों के मुख्य शब्दों की 10 मिनट दोहराई कीजिए, जब तक आप फिर से समय पर न आ जाएँ।`,
    },
    {
      key: "shift",
      en: `Move the rest of the plan forward by ${behindBy - 1} day(s) so Day ${nextIncompleteDay} is today. Completed lessons are kept.`,
      hi: `बाक़ी योजना को ${behindBy - 1} दिन आगे खिसका दीजिए ताकि दिन ${nextIncompleteDay} आज हो। पूरे किए गए पाठ सुरक्षित रहेंगे।`,
    },
  ];
  let examWarning: RecoveryPlan["examWarning"];
  if (s.examDate) {
    const shifted = { ...s, scheduleShiftDays: s.scheduleShiftDays + (behindBy - 1) * parts };
    const end = courseEndDate(shifted);
    if (diffDays(s.examDate, end) > 0) {
      examWarning = {
        en: `With this shift the course would end on ${end}, after your exam date (${s.examDate}). Consider moving the exam date or increasing daily time — it is fine to adjust.`,
        hi: `इस बदलाव के साथ कोर्स ${end} को ख़त्म होगा, जो आपकी परीक्षा की तारीख़ (${s.examDate}) के बाद है। परीक्षा की तारीख़ आगे बढ़ाने या रोज़ का समय बढ़ाने पर विचार कीजिए — ऐसा बदलाव करना बिल्कुल ठीक है।`,
      };
    }
  }
  return { behindBy: behindBy - 1, currentDay: nextIncompleteDay, scheduledDay, options, examWarning };
}

/** Pronunciation scaffolding default by course day (learner can override). */
export type Scaffold = "visible" | "collapsible" | "audio_first" | "off";
export function scaffoldForDay(day: number, mode: "auto" | "always" | "never", examPractice = false): Scaffold {
  if (mode === "always") return "visible";
  if (mode === "never") return "off";
  if (day <= 30) return "visible";
  if (day <= 60) return "collapsible";
  if (day <= 90) return "audio_first";
  return examPractice ? "off" : "audio_first";
}

export const NEW_CARD_LIMIT: Record<DailyMinutes, number> = { 45: 10, 90: 20, 150: 30, 180: 40 };
export const REVIEW_LIMIT: Record<DailyMinutes, number> = { 45: 60, 90: 120, 150: 200, 180: 250 };

export function expectedProgressNote(minutes: DailyMinutes, pace: Pace): { en: string; hi: string } {
  const parts = partsPerLesson(minutes, pace);
  if (pace === "complete" && parts > 1) {
    const days = 120 * parts;
    return {
      en: `Each lesson is done in full over ${parts} days, so the course takes about ${days} days. Slower, but nothing is skipped.`,
      hi: `हर पाठ ${parts} दिनों में पूरा होगा, इसलिए कोर्स लगभग ${days} दिन का होगा। धीमा, पर कुछ छूटेगा नहीं।`,
    };
  }
  if (minutes === 180) return { en: "120 days with extra practice time in every activity.", hi: "120 दिन, हर गतिविधि में अतिरिक्त अभ्यास के साथ।" };
  if (minutes === 150) return { en: "The recommended intensive plan: one full lesson per day for 120 days.", hi: "सुझाई गई गहन योजना: 120 दिनों तक रोज़ एक पूरा पाठ।" };
  return {
    en: `120 days with a trimmed set of exercises each day (about ${Math.round(itemShare(minutes, pace) * 100)}% of each lesson). Expect slower progress than the 150-minute plan, especially in speaking and writing.`,
    hi: `120 दिन, रोज़ हर पाठ का छोटा हिस्सा (लगभग ${Math.round(itemShare(minutes, pace) * 100)}%)। 150 मिनट वाली योजना से धीमी प्रगति की उम्मीद रखिए, ख़ासकर बोलने और लिखने में।`,
  };
}
