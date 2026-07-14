# Design Audit — Implementation Record (Phases 1–3)

**Status:** Phases 1–3 implemented and shipped in commit `ecd6d67` (105 files, +906/−1512), included in Android build **1.1.108 (versionCode 10108)**, device-verified 2026-07-14.

This document is the durable record of the three-phase UX/UI improvement plan and what
actually landed. The originating audit plan lived outside the repo (in a local planning
file); this file replaces it as the source of truth. Items below marked *verified* were
re-checked against the tree at commit `b2e4a19`.

---

## Phase 1 — Quick wins

- **Copy outliers fixed** — 3 raw/robotic user-facing strings replaced
  (e.g. "No bundle ID" → "Couldn't find this shared memory.").
- **Contrast failures fixed** — `.notebook-kicker` (was ~2:1, now reads off
  `--text-soft` at ~4.9:1); `--text-disabled` darkened (*verified:* now `125 125 125`,
  was `#8C8C8C` ≈3.0:1).
- **Dead dark-theme CSS deleted** (~200 lines) — confirmed via `theme-context.tsx`
  that `data-theme` is always `'paper'`. (The theme system itself was made paper-only
  in `83fde4f`; see also the Android sign-in invariants in
  `frontend/scripts/android-readiness.mjs` — theme work must never touch the native
  theme parent or Activity lifecycle.)
- **StreakCounter icon** — Lucide flame replaced with a hand-drawn Feather-style SVG
  (Feather has no flame glyph; a like-for-like swap wasn't possible).
- **ErrorState naming collision resolved** — route-boundary component renamed to
  `RouteErrorScreen` (*verified:* `components/error/RouteErrorScreen.tsx`).
- **Dead legacy dashboard branch deleted** (~540 lines, reachable only via
  `NEXT_PUBLIC_DASHBOARD_REFINED === '0'`) plus orphaned imports and 6 stale
  `nav-config` exports.
- **`/debug/push`** — confirmed already admin-gated; no fix needed (*verified*).
- **Kicker/overline unification** — 5 near-duplicate uppercase label classes merged
  into one typographic scale, distinct colors kept.

## Phase 2 — Structural

- **RouteHeader bug found & fixed** — dark-theme-era `border-white/8` /
  `bg-white/[0.03]` utilities rendered near-invisible on paper background on
  `/shared/view`.
- **`Modal` and `Sheet` primitives built** (shared focus-trap/Escape hook);
  `ConfirmDialog` and `CelebrationModal` migrated, cutting ~65 lines of duplicated
  a11y code (*verified:* `components/ui/modal.tsx`, `sheet.tsx`).
- **Button consolidation** — a duplicate Button was avoided; the established one in
  `form-elements.tsx` (used across 7 files) was enhanced instead: outline/danger
  variants, size, pill shape, `href` support — default rendering unchanged for
  existing callers.
- **Infinite-repaint animations tamed** — `entry-typing-glow` (active during every
  typing session) and `timeline-focus-breathe` converted from animated `box-shadow`
  to a pseudo-element opacity pulse; same visual, no per-frame repaint.
- **5 confirmed-dead keyframe blocks removed** (double-checked against host classes,
  not just keyframe names, after an initial pass wrongly flagged live ones).
- **Motion tokens added** — `--ease-notive`, `--duration-fast/base/slow`
  (*verified*), applied to the 3 spots using literal easing curves.

## Phase 3 — Polish

- **Radius token scale + codemod** — `card-*` tokens defined in
  `tailwind.config.ts` (*verified:* `card-105`–`card-130` etc.); arbitrary
  `rounded-[...]` usages reduced **293 → 30** (*verified*; remainder are
  intentional one-offs).
- **Off-palette slate recolored** to warm paper tokens (*verified:* zero slate
  colors remain in `globals.css`).
- **`DashboardNotebookView` raw hex extraction** — **62 → 1** raw hex literals
  (*verified*).
- **`/share/view` vs `/shared/view` consolidation** — assessed; the two routes
  remain deliberately separate (public share vs authed inbox). Consolidation was
  scoped out, not forgotten.
- **`type-*` typographic scale adoption** expanded across remaining screens.
- Final build/typecheck/test verification passed before ship.

---

## Deliberately not done / still open

- **Audit documents** (executive summary, top-10, screen-by-screen, UX writing
  guide, design-system report) were never produced as repo files — the audit pass
  went straight to implementation. If those docs are wanted, they must be written
  fresh; nothing exists to recover.
- **share/shared route consolidation** — deferred by choice (see above).
- **Remaining 30 arbitrary radii** — intentional leftovers; revisit only if the
  design system tightens further.
- **Android date-picker white-on-white** (system dark mode) — out of this plan's
  scope; tracked separately with hard constraints: any fix must be scoped to the
  dialog theme, never the Activity or app theme (two auth outages resulted from
  violating this — see `frontend/scripts/android-readiness.mjs`).
