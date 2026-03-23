# Notive Student Reflection OS

Implementation plan and UI/UX direction for an action-first student experience.

Companion build spec: `STUDENT_REFLECTION_EXECUTION_SPEC.md`

Date: March 22, 2026

## V1 Scope Freeze

The current student reflection flow is now strong enough for a first real release.
Do not keep expanding the product tree before validating usage.

The working v1 loop is:

- capture one note
- generate one grounded action brief
- show one primary support option when needed
- show one backup path only when history says the first option may not be enough
- learn from the student's own feedback

### Keep In V1

- `Today Desk`
- `Action Brief`
- `Bridge Builder`
- `Safety Mode`
- `Support Constellation`
- trusted contacts, support memory, and outcome feedback

### Hold For Later

- more adaptive safety branching
- scenario simulation and future-self flows
- additional support sub-modes
- more dashboard cards or explanatory panels
- new AI surfaces or new top-level navigation

### Complexity Guardrails

1. One primary support recommendation at a time.
2. One backup path only when repeated outcomes suggest it is needed.
3. Home should not stack multiple support explanations if the same logic already appears in Bridge Builder.
4. Deep support reasoning belongs in `Guide`, `Bridge Builder`, and `Patterns`, not everywhere.
5. Safety responses should stay short and directive.

## Validation Before Expansion

Before adding any new student-support branch, run the scenario QA checklist in `STUDENT_REFLECTION_EXECUTION_SPEC.md`.

The goal for the next cycle is not feature breadth. It is to make the current loop feel trustworthy across the core student moments we already support.

## Product Thesis

Notive should become the private system that helps a student:

- capture what happened
- understand what pattern is forming
- decide one safe next move
- reach a real person faster
- preserve proof of growth for later school and career use

This is not a therapy chatbot and not a generic AI journal.
It is a grounded reflection product with a future payoff.

## Design Principles

1. Action before abstraction.
Every insight should end in one practical next move, one reflection question, or one human handoff.

2. Grounded, not mystical.
The UI should always show which notes shaped the output.

3. Calm, not gamified.
Drop the Quest Avatar layer. Momentum should feel steady, intelligent, and respectful.

4. Human-connected by design.
The product should help students reach teachers, counselors, parents, coaches, mentors, and friends instead of replacing them.

5. Small wins compound into future proof.
A note written in 9th grade should be able to become a strength, a story, and later a statement or resume example.

6. Privacy-forward and anti-dependence.
Short sessions, visible grounding, explicit uncertainty, and no open-ended emotional attachment loop.

## Product Pillars

### 1. Steady Me
Help the user regulate, name what is happening, and decide the smallest useful next step.

### 2. Reach Someone
Help the user remember who supports them and prepare a message or conversation when needed.

### 3. See My Growth
Turn ordinary life into evidence of resilience, responsibility, leadership, curiosity, and direction.

### 4. Shape My Future
Turn lived experience into statements, interview stories, pathways, and personal direction.

## Experience Architecture

Use the current navigation and evolve the meaning of each surface instead of adding a brand new top-level IA.

### Home
Becomes the `Today Desk`.

Primary modules:

- `Now`: what the recent notes suggest is active right now
- `Next Move`: one small action for today
- `Reach Out`: one person or place worth reconnecting with
- `Keep`: one strength or lesson this period is reinforcing

### Memories
Stays the factual record.

New role:

- source of grounded evidence
- place to inspect past moments that helped
- place to reopen stories and compare then vs now

### Patterns
Becomes the `Signal Room`.

Subviews:

- `Signals`: moods, recurring themes, friction points
- `Support`: people, places, routines, classes, clubs, habits that help
- `Strengths`: repeated capabilities and personal traits
- `Arcs`: identity changes over time

### Guide
Becomes the `Action Console`.

The current guided reflection surface should shift from open prompting to a structured sequence:

- what is happening
- what helped before
- who could help now
- what should I write or do next

### Stories
Becomes the `Proof Studio`.

This remains the long-game payoff surface:

- evidence ledger
- resume bullets
- statement story bank
- interview stories
- growth portfolio

### Me
Adds support preferences, trusted-contact preferences, and privacy/safety controls.

## Creative UI Direction

The current aesthetic already has a strong glass-panel, low-light, reflective feel. Keep that, but give each new surface a more intentional emotional job.

### Visual Concept

`Signal, Support, Proof`

Instead of dashboards that feel corporate or therapy apps that feel soft and generic, the product should feel like a private studio desk at night:

- dark slate canvas
- frosted panels
- serif editorial headings
- quiet gradients
- subtle topographic or constellation-like linework in backgrounds
- clear state colors with meaning

### Surface Language

- `Today Desk`: warm steel, slightly brighter glow, focused and immediate
- `Signal Room`: denser overlays, map-like layouts, pattern and relationship views
- `Action Console`: clean vertical reading rhythm, fewer controls, stronger grounding panels
- `Proof Studio`: more structured paper-like panels inside the dark shell, feels export-ready

### New UI Motifs

#### Compass Cards
Used for `Now`, `Next Move`, `Reach Out`, and `Keep`.

Visual treatment:

- rounded large cards
- serif title plus short plain-language summary
- one high-contrast CTA
- one line of grounding: `Built from 3 recent notes`

#### Bridge Cards
Used for human handoff.

Visual treatment:

- split layout with `Why this person`, `What to say`, `Open note evidence`
- text message, email, and talk-in-person variants
- soft amber highlight, not warning-red

#### Proof Ledger
Used in Stories.

Visual treatment:

- left rail: strength category
- center: evidence statement
- right rail: readiness badge
- paper-card inside glass container

#### Arc Ribbons
Used in Patterns for identity change over time.

Visual treatment:

- horizontal ribbons for traits like courage, consistency, curiosity, kindness, self-advocacy
- ribbons widen or brighten as signal strength increases
- clicking a ribbon opens notes that shaped it

#### Support Constellation
Used in Patterns > Support.

Visual treatment:

- people, places, routines, and spaces as nodes
- line weight based on recurrence and positive correlation
- selecting a node reveals best notes, mood lift, and suggested reconnection action

### Motion

Use a restrained motion system:

- staggered reveal on page load
- card emphasis on selection
- soft line tracing for support maps and arc ribbons
- no playful bounce loops, reward explosions, or game-like confetti

### Tone

Copy should sound:

- calm
- competent
- specific
- non-clinical
- never overly cheerful when the user is struggling

Good examples:

- `This week seems heavier than usual. Start with one small task, not the whole problem.`
- `You usually feel steadier after reaching out to one trusted person.`
- `This pattern also shows responsibility, not just stress.`

## Core Features and Phasing

## Phase 0: Safety and Trust Foundation

Ship this before or alongside the first action surface.

### Goals

- prevent unsafe “AI companion” dynamics
- route high-risk moments into safety mode
- make grounding and human handoff visible

### Backend

- add a `student-safety.service.ts`
- implement a red/yellow/orange/red signal taxonomy for:
  - self-harm language
  - suicidal ideation
  - abuse or coercion language
  - immediate danger
  - severe isolation
- enrich `analysis` JSON with:
  - `risk.level`
  - `risk.signals`
  - `risk.mode`
  - `risk.generatedAt`
- add deployment-level safety resource configuration:
  - crisis phone/text resources
  - region fallback copy
  - trusted-adult guidance

### Frontend

- add a safety state banner component reused in Guide, Home, and Entry Detail
- create a `Safety Card` layout with:
  - immediate support text
  - call/text action
  - `talk to someone now` drafts
  - `show me the note that triggered this`

### UX Guardrails

- never continue normal reflective chat after a red-level trigger
- always present a human-contact path
- keep safety responses short and directive
- do not promise confidentiality beyond real product constraints

### Suggested Touchpoints

- [backend/src/services/nlp.service.ts](/c:/Users/mtabe/Notive/backend/src/services/nlp.service.ts)
- [backend/src/controllers/ai.controller.ts](/c:/Users/mtabe/Notive/backend/src/controllers/ai.controller.ts)
- [frontend/src/app/chat/page.tsx](/c:/Users/mtabe/Notive/frontend/src/app/chat/page.tsx)
- [frontend/src/app/dashboard/page.tsx](/c:/Users/mtabe/Notive/frontend/src/app/dashboard/page.tsx)

## Phase 1: What Helped Before + Action Brief

This is the first high-impact ship.

### User Outcome

When a student feels stress, conflict, or self-doubt, Notive should say:

- what this looks like
- what helped before
- one small next move
- one question to reflect on tonight

### Product Shape

Create a reusable `Action Brief` object:

- `headline`
- `pattern`
- `whatHelpedBefore`
- `nextMove`
- `followUpPrompt`
- `confidence`
- `groundingEntryIds`

### Data Strategy

Start in existing JSON and facet infrastructure before adding new tables.

- write to `Entry.analysis.action`
- write reusable facets via [backend/src/utils/embedding-facets.ts](/c:/Users/mtabe/Notive/backend/src/utils/embedding-facets.ts)
- add facet types like:
  - `coping_action`
  - `stress_trigger`
  - `steadying_routine`
  - `support_person`

### Backend Work

- add `student-action.service.ts`
- add endpoint `GET /api/v1/ai/action/today`
- add endpoint `POST /api/v1/ai/action/preview`
- extend guided reflection to optionally return an Action Brief instead of only text
- use hybrid retrieval to find similar past entries with better outcomes

### Frontend Work

Home:

- add `Today Desk` hero with four Compass Cards
- prioritize `Next Move` and `What Helped Before`

Guide:

- replace blank-state chat emphasis with action-first starter cards
- add a right-side grounding column with past notes that informed the brief

Entry Detail:

- add `When this happens again` card
- add `last time that helped` snippets

### Success Metrics

- action card click-through
- same-day return to marked next move
- open rate on grounded source notes
- reduced empty-chat starts

## Phase 2: Bridge Builder + Support Map

This is the human-connection moat.

### User Outcome

The student can see who helps, what spaces help, and quickly prepare a message or conversation.

### Product Shape

Two linked surfaces:

- `Support Map`: a living map of people, places, classes, routines, and groups
- `Bridge Builder`: a drafting tool for messages and in-person conversation prep

### Data Model Strategy

Use a staged approach.

#### Version 1

Store inferred support anchors inside:

- `UserProfile.personalizationSignals.supportMap`
- `Entry.analysis.support`

#### Version 2

Normalize into new tables if adoption is high:

- `SupportAnchor`
- `SupportAnchorEvidence`
- `SupportDraft`

### Backend Work

- infer anchors from names, places, classes, clubs, routines
- score them by recurrence, sentiment context, and post-mention improvement
- add endpoint `GET /api/v1/ai/support-map`
- add endpoint `POST /api/v1/ai/bridge-builder`

Bridge Builder output:

- `whyNow`
- `recommendedRecipient`
- `messageDraft`
- `talkTrack`
- `evidenceSummary`

### Frontend Work

Patterns:

- add `Support` tab with Support Constellation view
- node categories: person, place, routine, class, group

Guide:

- add `Bridge` lens
- show message drafts in-card with one-tap edit-in-place

Profile:

- add trusted support preferences and opt-in manual pinned anchors

### Success Metrics

- support-map opens
- message draft copy/use rate
- note-to-message conversion
- repeat use of pinned support anchors

## Phase 3: Hidden Strengths + Proof Builder

This is where emotional utility turns into long-term student value.

### User Outcome

A student realizes:

- ordinary life already contains evidence
- their strengths are broader than awards
- their stories get stronger without needing to start over later

### Product Shape

`Strength Ledger`

Strength families:

- responsibility
- resilience
- self-advocacy
- curiosity
- leadership
- care for others
- consistency
- communication
- initiative

Each strength card should include:

- short interpretation
- evidence notes
- confidence
- export readiness

### Backend Work

- extend [backend/src/services/opportunity.service.ts](/c:/Users/mtabe/Notive/backend/src/services/opportunity.service.ts)
- build `strength-extractor.service.ts`
- derive strengths from existing:
  - lessons
  - skills
  - opportunity evidence
  - recurring note themes
- add endpoint `GET /api/v1/ai/strengths`

### Frontend Work

Patterns:

- add `Strengths` tab
- use ledger cards rather than simple tags

Stories:

- add `Proof Builder` queue before export
- ask for:
  - date
  - outcome
  - artifact
  - who was affected
  - what changed

### Success Metrics

- strength-card opens
- evidence completion rate
- verified story count
- export readiness uplift

## Phase 4: Scenario Lab + Pathways Engine

This should be intentionally framed as reflective planning, not prediction.

### User Outcome

The student can test choices without being told their future.

### Product Shape

`Scenario Lab`

Input examples:

- Should I drop this class?
- Should I try for a club leadership role?
- Should I talk to my counselor?
- Is this major or path aligned with me?

Output structure:

- `what this choice may improve`
- `what it may cost`
- `what evidence from your notes points this way`
- `what to try before making the full decision`

`Pathways Engine`

Maps note-derived themes into:

- interests
- work values
- strengths
- possible pathways
- next exposure steps

### Data Strategy

Use O*NET-style career families and simple value clusters instead of ad hoc labels.

### Backend Work

- add `scenario-lab.service.ts`
- add `pathways.service.ts`
- add endpoint `POST /api/v1/ai/scenario-lab`
- add endpoint `GET /api/v1/ai/pathways`

### Frontend Work

Patterns or Stories:

- add `Future` tab or dedicated section inside Stories
- use side-by-side scenario cards with evidence notes underneath

### Guardrails

- never present a scenario result as certainty
- always show confidence and source notes
- encourage a real conversation for higher-stakes choices

## Phase 5: Application and Export Polish

This is where the existing Stories workspace becomes much stronger.

### User Outcome

By the time the student needs a statement, interview story, or resume bullet, the hard work is already done.

### Product Shape

Enhance existing export surfaces with:

- stronger proof requirements
- richer strength summaries
- college-specific reflection angles
- role or scholarship-specific story filtering

### Backend Work

- refine story scoring in [backend/src/services/opportunity.service.ts](/c:/Users/mtabe/Notive/backend/src/services/opportunity.service.ts)
- add filters for audience:
  - college
  - scholarship
  - early-career
  - internship

### Frontend Work

- add audience chips
- add evidence-strength indicators beside exports
- expose missing-proof prompts directly inside export view

## UI/UX Screen Concepts

## 1. Home: Today Desk

Top section:

- large editorial heading
- short summary line
- four Compass Cards in a responsive grid

Card order:

1. `Now`
2. `Next Move`
3. `Reach Out`
4. `Keep`

Below the grid:

- `What Helped Before` scroll lane
- `Signals gaining strength` strip
- `Proof quietly building` panel

### Why it works

The student lands on a calm, useful desk instead of a blank app shell.

## 2. Guide: Action Console

Layout:

- left: lens selector
- center: conversation and Action Brief
- right: grounded note cards

Suggested lenses:

- `Unpack`
- `Steady`
- `Bridge`
- `Future`

The center column should privilege structured outputs over long chatbot paragraphs.

Preferred output blocks:

- `What this seems like`
- `What helped before`
- `One move for today`
- `If you want, write about this next`

## 3. Patterns: Signal Room

Top switcher:

- `Signals`
- `Support`
- `Strengths`
- `Arcs`

Each tab should feel visually distinct without leaving the overall shell.

### Signals

- grouped cards
- mood and theme overlays
- friction and recovery patterns

### Support

- support constellation
- side panel with best anchor evidence

### Strengths

- ledger cards
- filter by school, home, social, work, personal

### Arcs

- trait ribbons
- click-to-open evidence notes

## 4. Stories: Proof Studio

Keep the current portfolio workspace direction but sharpen the hierarchy:

- `Proof Queue`
- `Ready Stories`
- `Statement Drafts`
- `Interview Bank`

Recommended addition:

- a sticky `Evidence Meter` that updates as the student improves a story

## 5. Entry Detail

New modules below each note:

- `What this note may be pointing to`
- `Last time this happened`
- `One next move`
- `Possible support anchor`
- `Future proof this note`

This makes each note immediately useful without forcing the user into the broader dashboards.

## Calm Momentum System

Replace gamification with a quieter momentum model.

Do not use:

- avatars
- levels
- coins
- streak obsession
- reward fireworks

Use instead:

- `steady days`
- `helpful check-ins`
- `stories clarified`
- `support moves taken`
- `proof built this month`

These are progress signals, not game mechanics.

## Implementation Notes for the Current Stack

## Services to Extend

- [backend/src/services/nlp.service.ts](/c:/Users/mtabe/Notive/backend/src/services/nlp.service.ts)
- [backend/src/services/guided-reflection.service.ts](/c:/Users/mtabe/Notive/backend/src/services/guided-reflection.service.ts)
- [backend/src/services/opportunity.service.ts](/c:/Users/mtabe/Notive/backend/src/services/opportunity.service.ts)
- [backend/src/utils/embedding-facets.ts](/c:/Users/mtabe/Notive/backend/src/utils/embedding-facets.ts)
- [backend/src/controllers/ai.controller.ts](/c:/Users/mtabe/Notive/backend/src/controllers/ai.controller.ts)
- [backend/src/controllers/entry.controller.ts](/c:/Users/mtabe/Notive/backend/src/controllers/entry.controller.ts)

## Frontend Surfaces to Extend

- [frontend/src/app/dashboard/page.tsx](/c:/Users/mtabe/Notive/frontend/src/app/dashboard/page.tsx)
- [frontend/src/app/chat/page.tsx](/c:/Users/mtabe/Notive/frontend/src/app/chat/page.tsx)
- [frontend/src/app/insights/page.tsx](/c:/Users/mtabe/Notive/frontend/src/app/insights/page.tsx)
- [frontend/src/components/portfolio/PortfolioWorkspace.tsx](/c:/Users/mtabe/Notive/frontend/src/components/portfolio/PortfolioWorkspace.tsx)
- [frontend/src/components/ui/surface.tsx](/c:/Users/mtabe/Notive/frontend/src/components/ui/surface.tsx)
- [frontend/src/components/layout/nav-config.tsx](/c:/Users/mtabe/Notive/frontend/src/components/layout/nav-config.tsx)

## Recommended New Frontend Components

- `components/action/CompassCard.tsx`
- `components/action/BridgeCard.tsx`
- `components/action/ActionBriefPanel.tsx`
- `components/patterns/SupportConstellation.tsx`
- `components/patterns/StrengthLedger.tsx`
- `components/patterns/IdentityArcRibbon.tsx`
- `components/stories/EvidenceMeter.tsx`
- `components/safety/SafetyBanner.tsx`

## Recommended New Backend Modules

- `services/student-action.service.ts`
- `services/student-safety.service.ts`
- `services/support-map.service.ts`
- `services/strength-extractor.service.ts`
- `services/scenario-lab.service.ts`
- `services/pathways.service.ts`

## Data Model Guidance

Favor a staged rollout.

### First

Use existing structures:

- `Entry.analysis`
- `EntryAnalysis`
- `EntryEmbeddingFacet`
- `UserProfile.personalizationSignals`

This lets the team ship early without a wide schema blast radius.

### Later

Normalize only the durable concepts:

- support anchors
- safety events
- saved action briefs
- pathway signals

## Success Criteria

Primary:

- more users reopen grounded source notes
- more users act on a suggested next move
- more users build verified stories over time
- more users move from reflection into support contact when needed

Secondary:

- higher completion inside Stories
- better quality statement and resume exports
- more repeated use of Guide without long idle chat sessions

## MVP Recommendation

If shipping in the next 2 to 4 weeks, prioritize:

1. Safety foundation
2. What Helped Before
3. Action Brief on Home and Guide
4. Bridge Builder
5. Strength Ledger lite

That sequence gives Notive a clear differentiator quickly:

- grounded
- useful today
- safer for students
- stronger later for stories and applications

## Final Positioning

Notive should feel like:

- a private desk, not a feed
- a guide, not a companion
- a reflection studio, not a therapy bot
- a proof builder, not just a mood tracker

The strongest promise is:

`Write what happened. See what it means. Know what to do next. Keep what it proves.`
