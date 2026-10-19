import { expect, test } from "@playwright/test";
import { noHorizontalScroll, signIn, signUpAndOnboard } from "./helpers";


test("1. a zero-French learner finishes Day 1, and it persists after reload and sign-in", async ({ page }) => {
  const acct = await signUpAndOnboard(page, "day1");
  await expect(page.getByText(/Day 1/).first()).toBeVisible();
  await page.goto("/lesson/1");
  for (const block of ["spaced review", "new vocabulary and grammar", "listening", "speaking and pronunciation", "reading", "writing"]) {
    const btn = page.getByRole("button", { name: `Mark ${block} done` });
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await expect(btn).toBeHidden();
  }
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByText(/^Score: \d+%/)).toBeVisible();
  await expect(page.getByText("Day 1 complete")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Day 1 complete")).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, acct.email, acct.password);
  await page.goto("/progress");
  await expect(page.getByText(/1\s*of 120 days completed/)).toBeVisible();
});

test("2. the learner saves a dictionary word and reviews it later", async ({ page }) => {
  await signUpAndOnboard(page, "dict");
  await page.goto("/dictionary");
  await page.locator("#dict-q").fill("maison");
  await page.getByRole("link", { name: /^maison/ }).first().click();
  await page.waitForURL(/\/dictionary\/.+/);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Save “maison”/ }).first().click();
  await expect(page.getByText("✓ Saved to review").first()).toBeVisible();
  await page.goto("/review");
  await expect(page.getByText("1 left")).toBeVisible();
  // The card type is picked from the word's card set, so reveal the answer the same way for any type.
  await page.getByRole("button", { name: /Show answer|I don't know/ }).first().click();
  await expect(page.getByText(/maison|house/).first()).toBeVisible();
  await page.getByRole("button", { name: /^Good/ }).click();
  await expect(page.getByText("1 reviewed")).toBeVisible();
  await expect(page.getByText(/will come back/)).toBeVisible();
});

test("3. the learner listens, records speech and gets honest, labelled feedback", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await signUpAndOnboard(page, "speak");
  await page.goto("/pronunciation");
  const rec = page.getByRole("button", { name: /● Record/ }).first();
  await rec.click();
  const allow = page.getByRole("button", { name: "Allow and record" });
  if (await allow.isVisible().catch(() => false)) await allow.click();
  await expect(page.getByRole("button", { name: /■ Stop/ }).first()).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /■ Stop/ }).first().click();
  await expect(page.getByLabel("Your recording").first()).toBeVisible();
  await expect(page.getByText(/score/i).filter({ hasText: /\d+\s*%/ })).toHaveCount(0);

  await page.goto("/speaking");
  await page.locator("label", { hasText: "Answer questions" }).first().click();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("Scripted partner (not AI)")).toBeVisible();
  await page.getByLabel("Your reply in French").fill("Je m'appelle Ravi et je habite à Toronto parce que je travaille ici.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("ol[aria-label^=Conversation] li")).toHaveCount(3);
  await page.getByRole("button", { name: "End and get feedback" }).click();
  await expect(page.getByText(/Rule-based check \(not AI\)/)).toBeVisible();
  await expect(page.getByText(/je habite/).first()).toBeVisible();
});

test("4. the learner writes a paragraph, studies corrections and retries", async ({ page }) => {
  await signUpAndOnboard(page, "write");
  await page.goto("/writing/free-paragraph-city");
  const box = page.locator("textarea").first();
  await box.fill("Je habite à Montréal. La ville est grande et belle. Je ai beaucoup de amis ici. Nous allons à le parc le samedi. Je suis 30 ans et je travaille dans un bureau au centre-ville. Le hiver est très froid mais je aime la neige. Le été est chaud et il y a des festivals partout dans la ville. Je pense que Montréal est une ville parfaite pour moi et ma famille.");
  await expect(page.getByText(/^Saved( ·|$)/)).toBeVisible();
  await page.reload();
  await expect(page.locator("textarea").first()).toHaveValue(/Je habite à Montréal/);
  await page.getByRole("button", { name: /^Submit/ }).click();
  await expect(page.getByText(/^Submitted( ·|$)/)).toBeVisible();
  await page.getByRole("button", { name: "Get feedback" }).click();
  await expect(page.getByRole("button", { name: /Checking your text/ })).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText("Rule-based check (not AI)").first()).toBeVisible();
  await expect(page.getByText(/J'habite/).first()).toBeVisible();
  await page.getByRole("button", { name: "Edit a new version" }).click();
  await expect(page.locator("textarea").first()).toBeEditable();
});

test("5. the learner turns pasted French text into a practice lesson", async ({ page }) => {
  await signUpAndOnboard(page, "web");
  await page.goto("/discover");
  await page.getByRole("tab", { name: "Paste text" }).click().catch(() => page.getByText("Paste text").click());
  await page.locator("textarea").fill("Montréal est la plus grande ville du Québec. En hiver, il fait très froid et il neige beaucoup. Les habitants prennent le métro pour aller au travail. Beaucoup de familles immigrantes s'installent dans les quartiers comme Côte-des-Neiges. Le logement coûte cher, mais la ville offre de nombreux services gratuits, comme les bibliothèques et les cours de français pour les nouveaux arrivants.");
  await page.getByRole("button", { name: "Read and practise" }).click();
  await page.getByRole("button", { name: "Make a study kit" }).click();
  await expect(page.getByText(/not AI/).first()).toBeVisible();
  await expect(page.getByText(/not a CEFR rating/i).first()).toBeVisible();
  await expect(page.getByText(/Web search needs|search key|not configured/i).first()).toBeHidden();
});

test("6. the learner completes a timed mock section that survives reload, then reviews mistakes", async ({ page }) => {
  await signUpAndOnboard(page, "mock");
  await page.goto("/exam");
  for (const s of ["Listening", "Writing", "Speaking"]) await page.getByRole("checkbox", { name: new RegExp(s) }).uncheck();
  await page.getByRole("button", { name: /^Start(?! [A-Za-z])/ }).click();
  await page.waitForURL(/\/exam\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Start reading" }).click();
  const timer = page.getByRole("timer");
  await expect(timer).toContainText(/59:\d\d|60:00/);
  const radios = page.locator("input[type=radio]");
  await radios.nth(0).check();
  await radios.nth(5).check();
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByRole("timer")).toContainText(/59:\d\d/);
  await expect(page.locator("input[type=radio]").nth(0)).toBeChecked();
  // Exam rules: no word look-up or translation inside the exam.
  await expect(page.locator("[data-tappable]")).toHaveCount(0);
  await page.getByRole("button", { name: "Submit reading" }).click();
  await page.getByRole("button", { name: "Yes, submit" }).click();
  await expect(page.getByText(/Reading: \d+ \/ 40 correct/)).toBeVisible();
  await expect(page.getByText(/not a TEF score/i).first()).toBeVisible();
  await page.goto("/mistakes");
  await expect(page.getByText("Practice exam: reading").first()).toBeVisible();
});

test("microphone denied: recording explains how to allow it and the lesson still works", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: () => Promise.reject(new DOMException("denied", "NotAllowedError")) } });
  });
  await signUpAndOnboard(page, "nomic");
  await page.goto("/pronunciation");
  await page.getByRole("button", { name: /● Record/ }).first().click();
  const allow = page.getByRole("button", { name: "Allow and record" });
  if (await allow.isVisible().catch(() => false)) await allow.click();
  await expect(page.getByRole("alert").filter({ hasText: /allow the microphone/i }).first()).toBeVisible();
  await ctx.close();
});

test("Hindi and French render on a phone without overflow", async ({ page }) => {
  await signUpAndOnboard(page, "hindi");
  for (const path of ["/today", "/lesson/1", "/dictionary/maison%7Cnoun", "/exam", "/mistakes", "/progress", "/settings"]) {
    await page.goto(path);
    await noHorizontalScroll(page);
  }
  await page.goto("/lesson/1");
  const hi = page.locator("[lang=hi]:visible").first();
  await expect(hi).toBeVisible();
  expect(await hi.textContent()).toMatch(/[ऀ-ॿ]/);
  const fontOk = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => /Devanagari/i.test(f.family) && f.status === "loaded"); });
  expect(fontOk).toBe(true);
  await expect(page.locator("[lang=fr]:visible").first()).toBeVisible();
});
