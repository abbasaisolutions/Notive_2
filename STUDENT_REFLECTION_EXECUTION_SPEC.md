# Notive Student Reflection OS

Execution spec for the first delivery track.

Date: March 22, 2026

This file is the build-ready companion to `STUDENT_REFLECTION_IMPLEMENTATION_PLAN.md`.
The original plan defines product direction. This spec turns that direction into an executable MVP sequence for the current Notive stack.

## Current Build Rule

The student reflection system is now at the point where we should consolidate instead of branch.

For the next delivery cycle:

- refine the existing loop
- reduce duplicate support UI
- validate behavior with real student scenarios
- avoid adding new feature families unless they remove confusion or improve safety

### Stop Adding For Now

- extra support widgets on Home
- more fallback layers beyond one backup path
- more safety decision branches
- new future/planning engines
- additional output surfaces

### Focus Instead

- make the first recommendation feel clear
- make the backup path appear only when needed
- keep the support loop easy to understand
- measure which actions students actually use

## Scenario QA Checklist

Before expanding this system, test every release against the same core student moments.

### Every Scenario Should Pass

- the first screen shows one clear next move
- a human path appears when the moment is too heavy to hold alone
- the copy sounds calm and specific, not clinical or cheerleader-like
- the UI shows grounding without stacking too many explanation boxes

### School Stress

- does the action shrink the school problem into one small step?
- does the support path point toward a teacher, counselor, or coach when needed?
- does the copy avoid making the student sound lazy or behind as a character judgment?

### Friendship Conflict

- does the next move slow the conversation down before the app suggests reacting?
- does the bridge draft sound calm enough to send or say out loud?
- does the UI keep the focus on one conversation, not the whole relationship history?

### Family Tension

- does the action keep the first move low-pressure and realistic?
- does the support path leave room for another trusted adult when family is part of the stress?
- does the tone avoid sounding naive about home dynamics?

### Burnout Or Low Energy

- does the action start with a steadying move instead of productivity pressure?
- does the copy treat low energy as strain, not failure?
- does the screen still feel quiet and usable when the student has very little energy?

### Future Anxiety

- does the action frame the moment as direction-finding, not a final verdict?
- does the support path point toward a mentor, counselor, or trusted adult when useful?
- does the copy separate curiosity from pressure?

### Elevated Risk

- does the normal reflection flow get out of the way quickly?
- does the student immediately see a trusted person or crisis path?
- does the screen remove decorative or distracting language in this state?

## What We Are Shipping First

Ship the first student reflection release as one connected slice:

- `Phase 0`: Safety and trust foundation
- `Phase 1`: Action Brief and What Helped Before
- small `Phase 2` preview: a lightweight human handoff card inside Guide and Home

This means the first meaningful release is not a broad redesign.
It is one product promise:

`I wrote something hard. Notive helped me name it, showed what helped before, suggested one safe next move, and gave me a human option when needed.`

## Why This Slice First

This is the highest-leverage move for students because it:

- makes the app useful on the same day
- stays grounded in existing retrieval and reflection systems
- avoids unsafe AI companion behavior
- creates the foundation for later Support Map, Strength Ledger, and Proof Studio work

## Scope

### In Scope

- safety signals and short safety-mode responses
- reusable `Action Brief` generation
- `Today Desk` home experience
- `Action Console` guide experience
- grounded note evidence panels
- `When this happens again` module on note detail
- instrumentation for whether students actually use the actions

### Out of Scope

- model upgrades
- full Support Constellation graph
- new normalized support tables
- scenario simulation
- pathways engine
- new export flows
- gamification

## Product Promise

For a student or teenager, each supported interaction should answer four questions:

1. What seems to be happening?
2. What helped before?
3. What is one small thing I can do next?
4. Who could help if I should not do this alone?

## UX Principles For The MVP

- `Action-first`: the main payload is a brief, not a long chat answer
- `Grounded`: every brief points back to notes
- `Short`: use one clear next move, not a list of seven
- `Calm`: no game language, no false hype
- `Human-aware`: always keep a person path visible when the moment is heavy
- `Private`: use the current local-first retrieval path, no extra cloud dependency

## Experience Map

### 1. Home -> Today Desk

The dashboard becomes a desk the student can pick up instantly.

Top region:

- greeting and summary line
- four `Compass Cards`
- one grounding line under each card

Card order:

1. `Now`
2. `Next Move`
3. `Reach Out`
4. `Keep`

Below the cards:

- `What Helped Before` lane
- `Recent Signals` strip
- `Quiet Proof` panel

### 2. Guide -> Action Console

The guide should stop behaving like an empty chatbot shell.

New layout:

- left rail: reflection lens picker
- center column: `Action Brief` and follow-up prompt
- right rail: grounding notes and support card

The student should be able to begin without typing.

Starter cards:

- `Unpack what is happening`
- `Show me what helped before`
- `Help me figure out one next move`
- `Help me talk to someone`

### 3. Entry Detail

Each note should become useful on its own.

New modules under the note:

- `What this note may be pointing to`
- `Last time this happened`
- `One next move`
- `Possible support person or place`
- `Future proof this note`

## Creative UI Direction

Keep the current dark reflective shell, but make it feel more intentional and editorial.

### Visual System

- background: deep slate with low-contrast contour lines
- panels: frosted charcoal glass
- accent: steel blue for grounded action, amber for support, coral only for safety escalation
- typography: keep serif headlines and plain sans body rhythm
- spacing: larger vertical breathing room than the current dashboard

### Motion

- page load uses short staggered card reveals
- card selection uses subtle emphasis, not bounce
- evidence panel hover uses a slight surface lift
- safety mode removes decorative motion

### Copy Style

Preferred:

- `This looks like a familiar pressure pattern. Start smaller than the whole problem.`
- `A short reset helped before. Try repeating the easiest version of it today.`
- `This might be a good time to reach out instead of carrying it alone.`

Avoid:

- `You got this!`
- `Level up your growth`
- `Let's beat the challenge`

## MVP User Flows

### Flow A: Stress Or Overwhelm

1. Student writes a note about school stress.
2. Analysis runs.
3. Dashboard `Next Move` card updates with one action.
4. `What Helped Before` shows a related note and the helpful routine that appeared then.
5. Student opens Guide.
6. Guide shows the same grounded Action Brief plus one prompt for tonight.

### Flow B: Friendship Conflict

1. Student asks Guide what to do.
2. Retrieval finds similar moments and notes that mention a calming routine or trusted person.
3. Guide shows:
   - what this seems like
   - what helped before
   - one message draft starter
   - one grounding note
4. If signals are elevated, a support card appears above the draft.

### Flow C: High-Risk Signal

1. Student note or guide query includes high-risk language.
2. Safety service sets elevated risk.
3. Standard reflection response is suppressed.
4. UI shows the short Safety Card and trusted-human options.

## Core Data Contract

Keep the first version inside existing `analysis` and retrieval structures.

### Action Brief Shape

```ts
type ActionBrief = {
  headline: string;
  pattern: string;
  whatHelpedBefore: {
    summary: string;
    entryId: string | null;
    title: string | null;
    reason: string;
  } | null;
  nextMove: {
    label: string;
    description: string;
    effort: 'low' | 'medium';
    type: 'reflect' | 'routine' | 'school' | 'reach_out';
  } | null;
  reachOut: {
    label: string;
    rationale: string;
    draftStarter: string | null;
  } | null;
  keep: {
    label: string;
    evidence: string;
  } | null;
  followUpPrompt: string;
  confidence: number;
  groundingEntryIds: string[];
  createdAt: string;
};
```

### Risk Shape

```ts
type StudentRisk = {
  level: 'none' | 'yellow' | 'orange' | 'red';
  mode: 'normal' | 'supportive' | 'elevated' | 'emergency';
  signals: string[];
  generatedAt: string;
};
```

### Storage Strategy

- `Entry.analysis.action`
- `Entry.analysis.risk`
- `EntryEmbeddingFacet` additions for:
  - `coping_action`
  - `steadying_routine`
  - `stress_trigger`
  - `support_person`

No new database tables in the first slice.

## Backend Execution Plan

### New Service: `student-safety.service.ts`

Responsibilities:

- inspect note text, reflection text, and guide query text
- classify into `none`, `yellow`, `orange`, `red`
- return display-safe UI copy suggestions
- expose a short-circuit helper for Guide

Inputs:

- note content
- optional existing analysis
- optional recent note summaries

Outputs:

- `StudentRisk`
- `shouldInterruptNormalGuidance`
- `recommendedSupportCopy`

### New Service: `student-action.service.ts`

Responsibilities:

- assemble `Action Brief`
- use hybrid retrieval to find similar past moments
- prefer helpful or stabilizing patterns over generic similarity
- create one next move and one follow-up prompt

Inputs:

- current entry or query
- recent notes
- retrieval matches
- optional analysis-memory context

Outputs:

- `ActionBrief`
- debug grounding metadata for admin inspection

### Extend `guided-reflection.service.ts`

Add a response path that returns structured output in addition to text:

- `actionBrief`
- `risk`
- `supportCard`
- `highlights`

Guide should still return readable prose, but the UI should render the structured brief first.

### Extend `ai.controller.ts`

Add endpoints:

#### `GET /api/v1/ai/action/today`

Returns the best current brief for Home.

Selection logic:

- use the most recent meaningful entry if present
- otherwise summarize the last 7 to 14 days
- if no notes, return starter copy and a null brief

#### `POST /api/v1/ai/action/preview`

Builds a brief from unsaved or saved text.

Request:

```json
{
  "entryId": "optional-saved-id",
  "content": "optional-unsaved-text",
  "lens": "clarity"
}
```

Response:

```json
{
  "brief": {},
  "risk": {},
  "supportCard": null,
  "highlights": []
}
```

### Extend `nlp.service.ts`

Do not make this the owner of student action logic.
Only use it for existing analysis enrichment where needed.

### Suggested Backend File Ownership

- `backend/src/services/student-safety.service.ts`
- `backend/src/services/student-action.service.ts`
- `backend/src/services/guided-reflection.service.ts`
- `backend/src/controllers/ai.controller.ts`
- `backend/src/utils/embedding-facets.ts`

## Frontend Execution Plan

### New Components

- `frontend/src/components/action/CompassCard.tsx`
- `frontend/src/components/action/ActionBriefPanel.tsx`
- `frontend/src/components/action/WhatHelpedBeforeRail.tsx`
- `frontend/src/components/action/SupportPromptCard.tsx`
- `frontend/src/components/safety/SafetyBanner.tsx`
- `frontend/src/components/safety/SafetyCard.tsx`

### Dashboard Changes

Target file:

- `frontend/src/app/dashboard/page.tsx`

New data fetch:

- `GET /api/v1/ai/action/today`

New composition:

- keep top hero shell
- replace broad dashboard emphasis with `Today Desk`
- render four Compass Cards above resurfaced moments and cluster content

Desktop layout:

```text
+---------------------------------------------------------------+----------------------+
| Today Desk                                                    | Quick search         |
| Summary line                                                  | Write                |
|                                                               | Memories             |
| [Now] [Next Move]                                             | Stories              |
| [Reach Out] [Keep]                                            |                      |
|                                                               | Safety / status      |
| What Helped Before                                            |                      |
| [note] [note] [note]                                          |                      |
+---------------------------------------------------------------+----------------------+
```

Mobile layout:

```text
Today Desk
[Now]
[Next Move]
[Reach Out]
[Keep]
What Helped Before
[note]
[note]
```

### Guide Changes

Target file:

- `frontend/src/app/chat/page.tsx`

New behavior:

- starter cards before first message
- render `ActionBriefPanel` above assistant prose when present
- render `SafetyBanner` or `SafetyCard` before any normal response
- right column on desktop for grounding note cards

Desktop layout:

```text
+-------------+--------------------------------------+----------------------+
| Lenses      | Action Brief                         | Grounding            |
| Unpack      | What this seems like                 | [note evidence]      |
| Steady      | What helped before                   | [note evidence]      |
| Bridge      | One move for today                   | [note evidence]      |
| Future      | Write about this next                | Support prompt       |
+-------------+--------------------------------------+----------------------+
```

Mobile layout:

- lenses become horizontal chips
- Action Brief stays above the conversation stream
- grounding notes collapse into an accordion

### Entry Detail Changes

Target route:

- `frontend/src/app/entry/view/page.tsx`

Add a lower section titled `Use This Note`.

Modules:

- `When this happens again`
- `What helped before`
- `Future proof this note`

The purpose is to make one note immediately actionable without sending the student elsewhere.

## Interaction Rules

### If The Brief Has Low Confidence

- keep the cards visible
- add `This is a best guess from a small number of notes`
- do not hide grounding

### If There Is No Good Past Match

- omit `What Helped Before`
- replace with `No close past match yet`
- keep `Next Move` and `Follow-up Prompt`

### If Risk Level Is Yellow

- keep standard reflection experience
- add a slim support-aware banner

### If Risk Level Is Orange

- keep the brief short
- elevate the support card above other content

### If Risk Level Is Red

- suppress standard guidance panel
- show Safety Card only
- do not render growth-oriented copy in the same response block

## Analytics Events

Add only the events needed to learn whether this is working.

- `action_today_loaded`
- `action_compass_card_opened`
- `action_grounding_note_opened`
- `guide_starter_selected`
- `guide_action_preview_loaded`
- `support_prompt_opened`
- `support_prompt_copied`
- `safety_card_shown`
- `safety_call_cta_clicked`

## Acceptance Criteria

### Phase 0

- high-risk queries do not continue into normal reflection output
- a safety banner can render from both saved-note and typed-query contexts
- support copy is short, directive, and visible on mobile

### Phase 1 Backend

- `GET /api/v1/ai/action/today` returns useful starter data for:
  - no notes
  - one recent note
  - multiple recent notes
- `POST /api/v1/ai/action/preview` can evaluate unsaved text
- Action Brief always includes:
  - headline
  - pattern
  - follow-up prompt
  - confidence

### Phase 1 Frontend

- dashboard shows four Compass Cards without layout break on mobile
- guide can begin from starter cards without typing
- at least one grounding note is openable from dashboard or guide when available
- entry detail displays the `Use This Note` block without changing the current note-reading flow

## Sprint Plan

### Sprint 1: Trust Foundation

- create `student-safety.service.ts`
- define risk taxonomy and UI copy
- thread risk objects into Guide responses
- build `SafetyBanner` and `SafetyCard`

### Sprint 2: Action Brief Engine

- create `student-action.service.ts`
- define Action Brief contract
- build `GET /ai/action/today`
- build `POST /ai/action/preview`
- add new embedding facet types

### Sprint 3: Today Desk

- add dashboard fetch and loading states
- build Compass Cards
- add `What Helped Before` lane
- instrument analytics events

### Sprint 4: Action Console

- add starter cards
- add structured `ActionBriefPanel`
- add right-side grounding rail
- add support-aware response behavior

### Sprint 5: Entry Detail Bridge

- add `Use This Note`
- reuse Action Brief preview endpoint
- add note-level instrumentation

## Open Decisions

These decisions should be made before implementation starts, but none block the spec itself.

- whether trusted-contact preferences live fully in profile now or later
- whether orange-risk guide results should still show one support draft or only pure safety copy
- whether `Reach Out` on Home defaults to person-first or routine-first when no person signal exists

## Recommended Immediate Build Order

If we start coding next, do it in this order:

1. `student-safety.service.ts`
2. `student-action.service.ts`
3. `GET /api/v1/ai/action/today`
4. dashboard `Today Desk`
5. Guide `ActionBriefPanel`
6. entry detail `Use This Note`

That sequence gets Notive from strategy to a real student-facing reflection product with the least risk and the highest visible payoff.
