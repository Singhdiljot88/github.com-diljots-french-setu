/**
 * Spaced-repetition scheduler (SM-2 family with learning steps, similar to Anki's
 * default). Pure and deterministic so it can be unit-tested.
 */
export type Rating = "again" | "hard" | "good" | "easy";
export type CardState = "new" | "learning" | "review" | "relearning";

export type SrsCard = {
  state: CardState;
  ease: number;
  intervalDays: number;
  step: number;
  reps: number;
  lapses: number;
  dueAt: Date;
};

export const LEARNING_STEPS_MIN = [1, 10];
export const RELEARNING_STEPS_MIN = [10];
export const GRADUATING_INTERVAL = 1;
export const EASY_INTERVAL = 4;
export const MIN_EASE = 1.3;
export const MAX_INTERVAL = 365;

const MIN = 60_000;
const DAY = 86_400_000;

export function newCard(now: Date): SrsCard {
  return { state: "new", ease: 2.5, intervalDays: 0, step: 0, reps: 0, lapses: 0, dueAt: now };
}

const clampInterval = (d: number) => Math.min(MAX_INTERVAL, Math.max(1, Math.round(d)));

export function schedule(card: SrsCard, rating: Rating, now: Date): SrsCard {
  const c: SrsCard = { ...card, reps: card.reps + 1 };
  const graduate = (interval: number): SrsCard => ({ ...c, state: "review", step: 0, intervalDays: interval, dueAt: new Date(now.getTime() + interval * DAY) });

  if (card.state === "new" || card.state === "learning") {
    const steps = LEARNING_STEPS_MIN;
    const step = card.state === "new" ? 0 : card.step;
    switch (rating) {
      case "again": return { ...c, state: "learning", step: 0, dueAt: new Date(now.getTime() + steps[0] * MIN) };
      case "hard": {
        const delay = step === 0 && steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[step];
        return { ...c, state: "learning", step, dueAt: new Date(now.getTime() + delay * MIN) };
      }
      case "good":
        if (step + 1 < steps.length) return { ...c, state: "learning", step: step + 1, dueAt: new Date(now.getTime() + steps[step + 1] * MIN) };
        return graduate(GRADUATING_INTERVAL);
      case "easy": return graduate(EASY_INTERVAL);
    }
  }

  if (card.state === "relearning") {
    switch (rating) {
      case "again": return { ...c, step: 0, dueAt: new Date(now.getTime() + RELEARNING_STEPS_MIN[0] * MIN) };
      case "hard": return { ...c, dueAt: new Date(now.getTime() + RELEARNING_STEPS_MIN[0] * MIN) };
      case "good": return graduate(clampInterval(card.intervalDays));
      case "easy": return graduate(clampInterval(card.intervalDays * 1.5));
    }
  }

  // review
  const ivl = Math.max(1, card.intervalDays);
  switch (rating) {
    case "again": {
      const ease = Math.max(MIN_EASE, card.ease - 0.2);
      return { ...c, state: "relearning", step: 0, lapses: card.lapses + 1, ease, intervalDays: clampInterval(ivl * 0.5), dueAt: new Date(now.getTime() + RELEARNING_STEPS_MIN[0] * MIN) };
    }
    case "hard": {
      const ease = Math.max(MIN_EASE, card.ease - 0.15);
      const next = clampInterval(Math.max(ivl + 1, ivl * 1.2));
      return { ...c, ease, intervalDays: next, dueAt: new Date(now.getTime() + next * DAY) };
    }
    case "good": {
      const next = clampInterval(Math.max(ivl + 1, ivl * card.ease));
      return { ...c, intervalDays: next, dueAt: new Date(now.getTime() + next * DAY) };
    }
    case "easy": {
      const ease = card.ease + 0.15;
      const next = clampInterval(Math.max(ivl + 2, ivl * card.ease * 1.3));
      return { ...c, ease, intervalDays: next, dueAt: new Date(now.getTime() + next * DAY) };
    }
  }
}

/** Human-readable preview of the next interval for each button. */
export function previewIntervals(card: SrsCard, now: Date): Record<Rating, string> {
  const fmt = (d: Date) => {
    const ms = d.getTime() - now.getTime();
    if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))} min`;
    if (ms < DAY) return `${Math.round(ms / (60 * MIN))} h`;
    const days = Math.round(ms / DAY);
    return days < 31 ? `${days} d` : `${(days / 30).toFixed(1)} mo`;
  };
  const out = {} as Record<Rating, string>;
  for (const r of ["again", "hard", "good", "easy"] as Rating[]) out[r] = fmt(schedule(card, r, now).dueAt);
  return out;
}

/** Suggested rating from an automatically checked answer; the learner can override. */
export function suggestRating(result: "correct" | "accent" | "wrong", secondsTaken?: number): Rating {
  if (result === "wrong") return "again";
  if (result === "accent") return "hard";
  return secondsTaken !== undefined && secondsTaken < 4 ? "easy" : "good";
}
