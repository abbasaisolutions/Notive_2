# Notive Premium Transformation Plan

*Written 2026-07-19. Goal: eliminate the "AI-built" perception and make Notive read as a hand-crafted, trustworthy daily tool.*

---

## Part 1 — Diagnosis: what actually makes Notive feel AI-built

The problem is **not** missing polish infrastructure. Notive already has design tokens, progressive disclosure (`ColdStartGate.tsx`), ~24 empty states, breadcrumbs, a 3-tier nav, and even a voice file with a banned-word list. The problem is the opposite of what most audits assume: **the app is over-written, over-named, and over-animated.** Seven specific smells, with receipts:

### 1. The app narrates itself in third person, constantly
"Notive helps / keeps / starts / builds / notices / remembers / uses" appears in 16+ UI strings:
- "Notive starts its magic here and turns moments into patterns" (ColdStartGate.tsx:271)
- "One honest note is all it takes — Notive builds the rest alongside you" (ColdStartGate.tsx:275)
- "What Notive notices" (PrivacySection.tsx:704)
- "A few more days and Notive starts pulling threads across your notes" (StreakStrip.tsx:41)

Premium products never talk about themselves after login. Notion doesn't say "Notion helps you organize." The app's presence should be felt through what it *shows*, not what it *claims*.

### 2. Every string has a full literary arc — the uniformity is the tell
"Your latest memory already holds something useful." "Save the moment. Find the story." "An empty page is a good start." Individually each line is fine. Together, **hundreds of strings share one aphoristic cadence** — subject, gentle twist, quiet promise. Humans writing a product over months produce texture: terse labels here, a warm sentence there, a blunt error message. LLMs produce uniform warmth. The uniformity *is* the AI smell.

### 3. Proprietary-noun overload
Users must learn: Writer DNA, Emotional Fingerprint, Your Prime Time, Story Seeds, AskNotive, Threads, Bring In, First Read, Gentle Reflection, Journey Stages, plus the "Capture → Keep → Understand → Use" framework rendered as a dashboard eyebrow. Linear ships with three nouns (Issues, Projects, Cycles). Ten branded concepts reads as a theme park, not a tool. **Budget: 2 proprietary nouns, maximum.**

### 4. Over-explained microcopy
Every control gets a subordinate clause justifying itself:
- "Use the unlocked session to update your password without mixing it into ordinary profile edits." (SecuritySection.tsx:233)
- "We only use this to unlock sensitive account changes for a short time." (SecuritySection.tsx:114)
- "Keep the memory stream first; open topics when you want to narrow it." (timeline/page.tsx:2936)

Premium copy trusts the user. A password field labeled "Current password" needs no helper.

### 5. AI theater and detection language
`FirstReadCard` fakes a 900ms "Reading your entry…" state with a wiggling quill, then announces "Lesson extracted:", "Mood detected:", "Skills spotted:". Detection vocabulary reads as surveillance + chatbot. The data is good; the framing ruins it. Show the metadata quietly; never perform the analysis.

### 6. Hedged, unconfident language
"you *may* use later", "what it *may* be trying to tell you", "when you want it", "when you want a deeper read", "A *gentle* refresh usually fixes this". Plus copy A/B experiments (`smart_prompt_framing_v1`, `progressive_prompt_framing_v1`) and 3 rotating variants per empty state — the product hedges because nobody decided what it says. Rotating copy roulette is effort spent avoiding a decision.

### 7. Motion without a budget
Nearly every card mounts with `initial={{ opacity: 0, y: 10 }}` + staggered delays. When everything animates, nothing does. Premium motion is scarce and semantic (state change, confirmation), not entrance theater. Related: inline `style={{ color: 'rgb(var(--paper-ink))' }}` scattered where token classes exist, and 244 arbitrary `rounded-[...]` values (known, deferred).

---

## Part 2 — Voice & copy system

### Tone rules (replace the vibe-words in notive-voice.ts with mechanics)
1. **Labels are nouns. Buttons are verbs. Sentences only where the user must decide something.**
2. **Never name the app post-login.** Rewrite every "Notive <verb>s…" as either user-verb ("See what you've written about this") or plain fact ("Patterns appear after ~5 notes").
3. **One voice moment per screen.** Each screen gets at most one warm sentence. Everything else is functional.
4. **Kill hedges.** "may", "when you want", "gentle", "a few more" → state the fact or cut the line.
5. **No detection language.** "Mood detected" → "Mood". "Lesson extracted" → "Lesson". The product presents; it doesn't perform analysis.
6. **Specific beats poetic.** "Patterns appear after 5 notes" beats "Notive starts its magic."
7. **One string per slot.** Delete rotating variants and copy-framing experiments. Decide.

### Before / after — five real screens

**Empty dashboard** (ColdStartGate.tsx:268-281) — delete 3 rotating variants:
> ~~"Your dashboard grows with you. / After your first few notes, Notive starts its magic here and turns moments into patterns."~~
> **"Nothing here yet." / "Patterns, moods, and threads appear after your first few notes."** CTA: **"Write your first note"** (keep).

**First Read card** (ColdStartGate.tsx:199-260) — kill fake reading state + detection verbs:
> ~~"Reading your entry…" → "Lesson extracted: X / Mood detected: calm / Skills spotted: …" / "You write in the morning. Your record is building."~~
> Header: **"From this entry"**. Rows: **"Lesson — X"**, **"Mood — Calm"**, **"People — Sarah, Mr. Chen"**. Delete the closing aphorism. Keep the stagger reveal (it's good), cut the 900ms fake delay.

**Security section** (SecuritySection.tsx):
> ~~"Unlock this section before changing sign-in details or deleting the account." / "We only use this to unlock sensitive account changes for a short time." / "Use the unlocked session to update your password without mixing it into ordinary profile edits."~~
> **"Confirm it's you to change your email, password, or delete your account."** Password field: label "Current password", no helper. Third string: delete entirely. Toast "Sensitive account changes unlocked for a short time." → **"Confirmed. You can make account changes for the next 10 minutes."** (state the real duration — specificity is trust).

**Chat** (notive-voice.ts:95):
> ~~"Talk with your private mirror about notes, threads, lessons, and what you may want to use later."~~
> **No subtitle.** Suggestion chips become user-voiced and concrete: "What do I keep coming back to?", "Summarize this week", "Turn this into a resume bullet."

**Dashboard hero** (notive-voice.ts:126-128):
> ~~Eyebrow "Capture -> Keep -> Understand -> Use" / "Your latest memory already holds something useful."~~
> **Date + greeting + the user's own last entry.** The framework is internal strategy, not UI copy. Premium dashboards lead with *your* content, not the app's commentary about your content.

**Error page** (dashboard/error.tsx):
> ~~"A gentle refresh usually fixes this. Your entries are safe."~~
> **"Couldn't load the dashboard. Your entries are safe — refresh to try again."** (Keep the reassurance; cut the tweeness.)

### Naming consolidation (proprietary-noun budget: 2)
| Current | Rename to |
|---|---|
| AskNotive | Chat |
| Story Seeds | Stories |
| Bring In | Import |
| Me | Profile |
| Writer DNA | Writing style |
| Emotional Fingerprint | Mood map |
| Your Prime Time | When you write |
| Gentle Reflection | Daily reflection |
| **Threads** | **keep** (earns its place) |
| **Today** | **keep** (generic nav label, doesn't count against the budget) |

**Precise rule**: no more than **two branded feature names in persistent post-login navigation**. Threads occupies one slot; the second stays open. Generic labels (Today, Timeline, Chat, Import, Profile) don't count. The budget applies to nav and dashboard headings — not to internal code identifiers, which migrate later or never.

---

## Part 3 — UI/UX principles

1. **Motion budget**: entrance animation only on the primary surface per navigation; semantic motion (save confirm, streak tick, reveal-on-first-insight) keeps full treatment. Everything else renders instantly. Define 2–3 motion tokens (duration/easing) and delete per-component `initial/animate` boilerplate.
2. **The dashboard leads with user content.** Order: date/greeting → today's entry or write CTA → last entry → at most TWO insight cards → quiet links to deeper views. Insight cards state facts ("You've written 4 evenings in a row"), never meta-commentary.

   **State matrix** (each state must be designed explicitly — an unhandled state is where filler prose sneaks back in):
   | State | Shows |
   |---|---|
   | No entries ever | Date + write CTA + one line ("Patterns appear after your first few notes."). Nothing else. |
   | Has entries, none today | Date + write CTA + last entry preview + insight cards if tier permits |
   | Draft in progress | Date + "Continue writing" resuming the draft (replaces write CTA) + last entry |
   | Entries but below insight tier | Date + entry content + existing WhatsComingCard progress rings — **no prose substitute** |
   | Active user, no qualifying threads | Insight slots show simple facts (streak, count, time-of-day); thread cards simply absent — no "coming soon" filler |
3. **Token discipline**: no inline `rgb(var(--paper-*))` styles — utility classes only. The 244-radius cleanup lands here as the dedicated sprint (previously deferred, correctly).
4. **Density texture**: settings/profile should be *plain* — compact rows, system-feeling, minimal prose. Contrast between warm capture surfaces and utilitarian admin surfaces is what makes the warmth feel intentional.
5. **Keep** what's already good: tier gating, progress rings, the paper aesthetic, doodles (sparingly), aria work.

## Part 4 — Trust & compliance
- Consolidate data-usage explanations into the Privacy section; remove inline per-field justifications ("Events are read-only and never uploaded" can stay — it's specific and load-bearing; "Notive uses this to suggest the best way to reach out" goes).
- Trust through specificity: real durations ("10 minutes"), real thresholds ("after 5 notes"), real counts. Vague reassurance reads as legal cover; numbers read as engineering.
- One privacy statement at capture surfaces max: "Only you can read this." — nothing else, nowhere else.

## Part 5 — Feature prioritization
- **Sharpen**: Threads (the differentiator — private notes → reusable material), reminders (already shipped, expose quietly in Today), export (a visible "your data leaves whenever you want" is a premium trust signal).
- **Merge/cut**: 11 nav items is too many post-trim; fold Stories into Patterns-adjacent surface or a single "Use" surface; kill the gamification celebration modal ("Badge Unlocked!" fights the private-diary positioning — replace with a quiet inline streak acknowledgment).
- **Do not build new features for premium feel.** Premium is subtraction + reliability, not surface area.

## Part 6 — Roadmap

**Phase 1 — Copy sweep (low behavioral risk, highest leverage; ~1 week as three separate PRs)**

Split into three PRs so each is independently reviewable and revertable:

- **PR 1a — Copy & label replacements.** Purge self-narration, hedges, detection language across post-login surfaces; rename per the naming table (visible labels AND accessible names — `aria-label`s keyed to old terms must move together). Risk: low but not zero — copy changes can regress accessibility labels, snapshot tests, and analytics events keyed to displayed text; validate those, don't assume.
- **PR 1b — Experiment/variant retirement.** Delete rotating copy variants (`pickRotatingCopy` slots) and both framing experiments (`smart_prompt_framing_v1`, `progressive_prompt_framing_v1`). Before deleting, check what analytics/telemetry reads the variant assignment and retire those event properties in the same PR.
- **PR 1c — CI voice check.** Extend `NOTIVE_BANNED_PUBLIC_LANGUAGE` + `NOTIVE_PUBLIC_COPY_AUDIT_PATHS` into a CI script. **Scope it to user-visible string sources only** (the voice file + an explicit list of copy-bearing components), not all of `src/` — a blanket ban on `detected`/`gentle` would flag legitimate technical code, tests, and a11y text, and pressure evasive wording instead of better wording. Ban *constructions*, not words: `Notive (helps|keeps|starts|builds|notices|remembers)`, `\b(Mood|Lesson|Skill)s? (detected|extracted|spotted)`, `gentle (refresh|reflection|question)`, `starts its magic`. Support narrow inline suppressions with a required justification comment. **Explicit exception: user-authored content, imported data, and quoted material are never scanned or rewritten — the ban list governs Notive's voice, not the user's.**

**Phase 1 Definition of Done**
- [ ] No post-login app-name self-reference in user-visible strings
- [ ] No rotating copy variants remain in affected UI slots
- [ ] Every renamed term updated in: visible labels, accessible names, screenshots, affected tests
- [ ] CI scans only declared user-facing string locations; suppressions documented
- [ ] The five named screens reviewed at desktop and mobile widths in loading, empty, error, and populated states

**Phase 2 — Dashboard + motion (1 week)**
- Recompose dashboard order; remove eyebrow framework line; FirstRead → quiet metadata.
- Motion budget; motion tokens; strip entrance animations.

**Phase 3 — System consolidation (1–2 weeks, the dedicated design-system sprint)**
- Radius scale (fixes the 244), inline-style → token classes, settings-surface densification, nav trim.

**Metrics**

*Primary — the screenshot test, with a real protocol:*
- Participants: 8–10 people who use SaaS tools daily but have never seen Notive (not designers-only; mix in target students).
- Stimuli: the five named screens, before AND after versions, randomized order, one screen per card.
- Question per screen: "Was this screen designed by a person or generated by AI?" + confidence 1–5.
- Scoring: someone not on the project tallies. **Acceptance: after-screens rated "person" ≥70% of the time, and beat their before-counterparts on every screen.**
- Re-run after each phase with fresh participants (no repeats — memory contaminates).

*Secondary (directional only — copy/motion changes have noisy causal attribution; don't claim causation):* D7 retention, entries/user/week, time-to-first-entry, settings bounce rate. Watch for regressions more than improvements.

## Part 7 — AI-smell red-flag checklist
- [ ] App refers to itself by name post-login
- [ ] Any label > 3 words; any button that isn't a verb
- [ ] Helper text restating what the control obviously does
- [ ] "detected / extracted / spotted / analyzing…" language
- [ ] Fake latency to dramatize AI work
- [ ] Aphorism cadence in > 1 string per screen ("X. Y that reframes X.")
- [ ] Hedges: may, might, gently, when you want, a few
- [ ] Em-dash poetic constructions in UI strings
- [ ] Rotating/variant copy for the same slot
- [ ] Entrance animation on non-primary elements
- [ ] More than 2 proprietary nouns in nav
- [ ] Inline color styles where tokens exist
- [ ] Celebration modals in a privacy-first product

## Part 8 — AI usage guidelines (internal)
1. AI drafts, a human **cuts** — never ship a model's first draft of a UI string; the edit pass is always subtraction.
2. One owner for voice; the voice doc is written by hand and is the only source AI is prompted with.
3. Use AI for inventory/refactor/enforcement (find all strings, apply the ban list, migrate tokens) — mechanical work, where it excels.
4. Never ask AI to "make it warmer/more delightful" — that prompt generates the exact cadence this plan removes.
5. CI ban-list check is the backstop: if a model sneaks "gentle magic" into a PR, the build fails.
