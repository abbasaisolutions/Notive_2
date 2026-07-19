# Word Budget Plan

*2026-07-19. Follow-up to premium-transformation-plan.md. Goal: cut post-login copy by ~60% using strategies from the calmest well-crafted apps.*

## The numbers

~300 prose strings ≥70 chars post-login, ~5,000 words. Concentration:

| Surface | Long strings |
|---|---|
| PortfolioWorkspace | 55 |
| DashboardNotebookView | 27 |
| PrivacySection | 18 |
| ProfileSettingsEditor | 12 |
| entry/new | 12 |

## Diagnosis: advisor voice

The Phase-1 sweep removed self-narration. What remains is **coaching** — every state narrated in two sentences: "Start with the weakest stories first. A single missing block or clearer proof detail usually unlocks the rest of the queue." Calm apps never coach in prose. They show state and get out of the way.

## Borrowed strategies

1. **iA Writer — the interface recedes.** No element explains itself. If a control needs a sentence, redesign the control, don't caption it.
2. **Things 3 — empty states are furniture.** One quiet line, often none. Whitespace signals confidence; guidance lives in the CTA label.
3. **Apple Settings / Bear — settings are rows.** Label + current value. Explanation only behind ⓘ or on first use.
4. **Day One — content is the interface.** The user's own words are the decoration. UI copy competes with the diary; it should lose.
5. **Linear — status beats sentences.** State as chips, counts, sort order. "3 ready" replaces a paragraph of reassurance.
6. **Headspace — one thought per screen.** One focal message; all else quiet.
7. **Muji (kanketsu) — remove until it breaks.** Cut first, ship, restore only what users demonstrably miss.

## The budget (enforced, not aspirational)

| Slot | Max |
|---|---|
| Overline / section label | 2 words |
| Button | 3 words |
| Helper | 6 words — or delete |
| Empty state | 4-word title + 10-word line |
| Card body | 14 words |
| Toast | verb + object ("Saved", "Reminder set") |
| Any audited string | **90 chars hard CI limit** |

**Mechanism**: extend `notive-copy-audit.test.ts` with a length check over `NOTIVE_POSTLOGIN_COPY_AUDIT_PATHS` — flag prose literals >90 chars (≥8 spaces), `voice-ok` opt-out with reason. One-time diets regress; budgets don't.

## Before / after (real strings)

| Before | After |
|---|---|
| "Your evidence base is in good shape. Go straight into the interview workspace and rehearse one story at a time." | **"3 stories ready to rehearse."** |
| "Showing every story from least finished to strongest so the next fix is easy to spot." | **"Weakest first."** |
| "Start with the weakest stories first. A single missing block or clearer proof detail usually unlocks the rest of the queue." | *(delete — the sort order says it)* |
| "Capture another note when you want more material. The current queue does not need much attention right now." | **"Queue is in good shape."** |
| "Use the full queue when you want the complete picture of what is weak, ready, or already strong." | **"Full queue"** *(it's a toggle label)* |

Rule of thumb: when a sentence describes state, replace it with the state. When it gives advice, the advice becomes the sort order, the default, or the CTA — not text.

## Cut passes (by word mass)

- **PR-W1** — budget spec + CI length check. Nothing regresses after this.
- **PR-W2** — PortfolioWorkspace: advisor paragraphs → counts, chips, sort order. Biggest single win.
- **PR-W3** — DashboardNotebookView + settings sections: remaining narration → facts; settings to row model.
- **PR-W4** — entry editor + toasts: the editor is the sacred surface — near-zero chrome text; toasts to verb+object.

## Measure

- Words in prose strings ≥70 chars: 5,000 → **under 2,000**.
- Strings >90 chars in audited paths: → **~0** (excluding legal + suppressions).
- Screenshot test (from the main plan): re-run after PR-W3.

Exclusions: privacy/terms pages (legal precision > brevity), user-authored content, safety flows (never cut safety copy for style).
