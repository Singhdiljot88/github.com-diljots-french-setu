/**
 * Elision (l', d', j', qu'…) happens before a vowel sound. Most words starting with h have a silent
 * "h muet" and elide (l'homme, l'hôtel), but "h aspiré" words never do (le hockey, la hausse, les | haricots).
 * One shared list so games, conjugation and the writing checker agree.
 */
export const H_ASPIRE = new Set([
  // nouns and adjectives
  "hache", "haie", "haine", "hall", "halte", "hamac", "hamburger", "hameau", "hamster", "hanche", "handball", "handicap", "hangar",
  "harcèlement", "hareng", "haricot", "harpe", "hasard", "hâte", "hausse", "haut", "haute", "hauteur", "hérisson", "héros", "hêtre",
  "hibou", "hiérarchie", "hindi", "hippie", "hobby", "hockey", "hollandais", "hollandaise", "homard", "hongrois", "hongroise", "honte",
  "honteux", "honteuse", "hoquet", "hors", "hot-dog", "houle", "housse", "hublot", "huit", "huitième", "hurlement", "hutte",
  // verbs
  "haïr", "hurler", "heurter", "hâter", "hisser", "hausser", "harceler", "hacher", "hanter", "hocher", "huer",
]);

/** True if a word takes elision: starts with a vowel or an h muet. */
export function elides(word: string): boolean {
  const w = word.trim().toLowerCase();
  if (!/^[aeiouyhâàäéèêëîïôöûùüœæ]/.test(w)) return false;
  if (w.startsWith("h")) return !H_ASPIRE.has(w) && !H_ASPIRE.has(w.split(/[\s-]/)[0]);
  return true;
}

/** "le/la + noun" with elision where French needs it: l'homme, l'hôtel, but le hockey, la hausse. */
export function definite(lemma: string, gender: "m" | "f"): string {
  return elides(lemma) ? `l'${lemma}` : `${gender === "m" ? "le" : "la"} ${lemma}`;
}
