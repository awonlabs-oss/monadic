# Monadic — Design System

This file governs all UI and UX decisions in **monadic**. It is authored by a human
from Figma mockups.

**If you are an agent working on this codebase: read this file before touching any
UI. Where it is silent, stop and ask. Do not fill gaps with defaults.**

---

## Status legend

Every section carries a status. Build only against DECIDED.

| Status      | Meaning                                                            |
| ----------- | ------------------------------------------------------------------ |
| **DECIDED** | Locked. Implement exactly as written. Deviations need approval.    |
| **DRAFT**   | Direction is set, details may shift. Confirm before relying on it. |
| **OPEN**    | Not decided. Stop and ask. Do not proceed on assumption.           |

**Figma file:** https://www.figma.com/design/0tJgH96ncHm4HFAkRGrAVm — page `monadic — v0`

Current overall state: **v0 mocked.** Foundations, JobCard, the jobs feed, and the
tracked pipeline are DECIDED. The frontpage remains blocked. Everything else is OPEN.

---

## 1. Principles

**Status: DECIDED**

**Name:** monadic. Lowercase in code, URLs, and identifiers. Capitalized as "Monadic"
in prose and headings. The wordmark is lowercase, set in Inter Semi Bold at -3%
tracking, preceded by a small filled circle.

1. **Warm neutral, never cold.** The canvas is `#F4F3F1`, not white and not blue-grey.
   Cards are pure white and sit _on_ the canvas. Nothing is pure white on white.
2. **Ink is the accent.** Primary actions are near-black pills. There is exactly one
   non-neutral color in the system, a muted green used only for positive or live
   signals. If a screen needs a second accent, the screen is wrong.
3. **Dense enough to scan fifty postings.** This is a triage tool, not a reading
   surface. Generous radius, tight vertical rhythm.
4. **Absence is information.** Missing compensation is the common case, not an error.
   It gets designed treatment, never a dash.
5. **Chat is not the product.** Competitors put an assistant at the center. Monadic
   puts the jobs there. Any AI assistance is a side surface, never the main column.

<!--
Three to five sentences on what this should feel like. Not adjectives — decisions.
"Dense over airy, because I'm scanning fifty postings, not reading one."
"Neutral chrome so company logos and comp figures carry the color."
"Every screen answers one question. If it answers two, it's two screens."
-->

_To be written._

---

## 2. Tokens

**Status: DECIDED (synced from Figma)**

All values live in `/design/tokens.json`. That file generates the Tailwind theme and
CSS custom properties. Component code references semantic token names only — never
raw hex, px, or arbitrary Tailwind values.

Tokens are **semantic, not literal.** `--color-surface-raised`, not `--gray-100`.
The palette will change; the names must survive it.

### Adding a token

A value with no token is a design gap, not a judgment call. Ask. Do not invent one.

### Current token groups

| Group           | Prefix             | Status     |
| --------------- | ------------------ | ---------- |
| Color — surface | `color-surface-*`  | from-figma |
| Color — signal  | `color-signal-*`   | from-figma |
| Color — content | `color-content-*`  | from-figma |
| Color — border  | `color-border-*`   | from-figma |
| Color — accent  | `color-accent-*`   | from-figma |
| Color — status  | `color-status-*`   | from-figma |
| Spacing         | `space-*`          | from-figma |
| Radius          | `radius-*`         | from-figma |
| Typography      | `font-*`, `text-*` | from-figma |
| Elevation       | `shadow-*`         | from-figma |

---

## 3. Typography

**Status: DECIDED**

Inter throughout. Weights in use: Regular, Medium, Semi Bold. Nothing heavier.

| Token     | Size | Weight    | Tracking | Used for                     |
| --------- | ---- | --------- | -------- | ---------------------------- |
| `display` | 30   | Semi Bold | -3%      | Page titles on dense screens |
| `title`   | 26   | Semi Bold | -3%      | Route headings               |
| `lead`    | 17   | Semi Bold | -1.5%    | Job titles on cards          |
| `body`    | 13   | Regular   | 0        | Descriptions, subtitles      |
| `small`   | 12   | Medium    | 0        | Filters, buttons, meta       |
| `caption` | 11   | Regular   | 0        | Tertiary meta, tags          |

Negative tracking applies at 17px and above only. Below that it hurts legibility.

**Numerics.** Compensation figures and years-required are scanned, not read. They set
at `lead` weight in the card footer. When a range is present use an en dash with no
spaces (`$140–170k`). When it is absent, see section 7 — never render an empty string.

<!--
Typeface(s) and where each is used. The scale, as tokens, with the semantic role of
each step. Line heights. What weight means what.

Note especially: how do compensation figures and years-of-experience render? They're
scanned, not read. Tabular numerals?
-->

_To be written._

---

## 4. Layout

**Status: DECIDED for application routes**

- Fixed left sidebar, 248px, canvas-colored with a 1px right border. Never collapses
  at desktop widths.
- Main column fills the rest. 40px horizontal padding, 36px top.
- Sidebar order: wordmark, primary nav, saved views, spacer, ingestion health footer.
- The ingestion health footer is permanent, not a debug panel. Silent pipeline failure
  is this product's main failure mode and it stays visible.
- Job feed is a two-column card grid at 1440. Single column below 1100.
- Pipeline board is four fixed columns with an 18px gutter.

<!--
Grid or no grid. Max content width. Breakpoints and what changes at each.
Navigation shell: sidebar, top bar, or neither. Persistent or collapsible.
Density: how tight are list rows, really.
-->

_To be written._

---

## 5. Component inventory

**Status: OPEN**

Every component gets an entry before it gets built. An entry defines variants,
states, and behavior at the data edges.

### Template

```
### ComponentName
Status:
Figma:            <frame link>
Purpose:          <one line — what question it answers>
Variants:
States:           default / hover / focus / active / disabled / loading
Empty state:      <what shows when there is no data>
Overflow:         <what happens when content is too long>
Missing data:     <what shows when an expected field is null>
Tokens used:
Notes:
```

### Components needed for Phase 1

- [x] JobCard — feed card. Built, tokenized. Figma page `monadic — v0`.
- [x] ApplicationCard — compact pipeline card with status dot and next-action line
- [x] FilterPill — active (ink fill) and inactive (white, bordered, caret) variants
- [x] NavItem — active state is a white raised pill, not a color change
- [ ] JobDetail — full posting view
- [ ] PipelineBoard — status columns
- [ ] TimelineEvent — single event in an application history
- [ ] ContactCard — recruiter or hiring manager
- [ ] TemplateEditor — outreach template with variable insertion
- [ ] ProfileForm — parsed resume, editable
- [ ] EmptyState — shared, parameterized
- [ ] StatusBadge — application pipeline status

---

## 6. Surfaces

**Status: OPEN**

One entry per route. Reference frame required before implementation.

### Template

```
### /route
Status:
Figma:            <frame link>
Purpose:
Primary action:
Layout:
Components:
Empty state:
Loading state:
Error state:
Responsive:
```

### Routes in Phase 1

- [ ] `/` — **BLOCKED.** Frontpage is design-led. Do not build.
- [x] `/jobs` — job feed with filters. Mocked in Figma.
- [ ] `/jobs/[id]` — posting detail
- [x] `/applications` — pipeline board. Mocked in Figma.
- [ ] `/applications/[id]` — detail with timeline
- [ ] `/contacts` — recruiters and hiring managers
- [ ] `/templates` — outreach templates
- [ ] `/profile` — parsed resume and search criteria
- [ ] `/settings/companies` — seed list management
- [ ] `/settings/runs` — ingestion health

---

## 7. Empty and missing states

**Status: OPEN — but non-negotiable that these get designed**

The data is genuinely incomplete. These are not edge cases, they are the normal
case, and they need real designs rather than a dash.

| Situation                                 | Frequency          | Design                                                                                                                  |
| ----------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Compensation not listed                   | very common        | DECIDED — "Comp not listed", 13px Regular, `content/tertiary`. Occupies the same slot as a figure so rows stay aligned. |
| Years required not stated                 | very common        | DECIDED — tag reads "Yrs not stated" rather than being omitted. An absent tag implies the field was checked.            |
| No jobs match filters                     | common             | OPEN                                                                                                                    |
| Company has no contacts yet               | common at first    | OPEN                                                                                                                    |
| Application has no events beyond creation | common             | OPEN                                                                                                                    |
| Pipeline column is empty                  | common             | DECIDED — dashed `border/default` container, centered `content/tertiary` copy naming what would land there.             |
| Card is stale (no action, N days)         | common             | DECIDED — status dot and meta line switch to `status/stale`. Never a badge or banner.                                   |
| Ingestion run failed for a company        | occasional         | OPEN                                                                                                                    |
| Resume parsed a field incorrectly         | expected           | OPEN                                                                                                                    |
| Job closed since it was saved             | expected over time | OPEN                                                                                                                    |

Never render an empty string or a bare dash where a value is missing. Every absence
means something specific and should say so.

---

## 8. Interaction patterns

**Status: OPEN**

<!--
Loading: skeleton, spinner, or optimistic.
Destructive actions: confirm or undo.
Forms: save button or autosave.
Feedback: toast, inline, or none.
Keyboard: is this keyboard-driven? For a fifty-posting triage flow it probably
should be. j/k navigation, s to save, x to dismiss.
Motion: how much, if any.
-->

_To be written._

---

## 9. Accessibility

**Status: DECIDED**

Baseline, regardless of visual design:

- Semantic HTML. Landmarks, correct heading order, no div soup.
- Every control has an accessible name.
- Keyboard reachable, visible focus, no traps.
- Contrast meets WCAG AA — verified against real token values, not assumed.
- Color never carries meaning alone. Status needs a label or shape too.
- Respect `prefers-reduced-motion`.

Interactive behavior comes from shadcn/ui primitives, which are accessible by
default. Do not hand-roll dropdowns, dialogs, or comboboxes.

---

## 10. Reference frames

Exports live in `/design/references/`, named to match the route or component they
depict.

| File                      | Depicts                   | Figma link          | Exported |
| ------------------------- | ------------------------- | ------------------- | -------- |
| Foundations               | Tokens, type ramp, radius | page `monadic — v0` | in file  |
| Screen / Jobs feed        | `/jobs`                   | page `monadic — v0` | in file  |
| Screen / Tracked pipeline | `/applications`           | page `monadic — v0` | in file  |
| JobCard                   | Feed card component       | page `monadic — v0` | in file  |

Where a Figma file URL is available, pull design context directly from Figma rather
than working from the PNG. Match variable names and spacing exactly.

---

## 11. Decision log

Record what changed and why. Prevents relitigating and tells future-you what the
constraint actually was.

| Date       | Decision                                            | Reasoning                                                                                                                              |
| ---------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-25 | Warm neutral `#F4F3F1` canvas over cool grey        | Cool greys read as generic SaaS; warm neutral matches the editorial references and lets white cards separate without shadow            |
| 2026-08-25 | Ink as the only accent, one muted green for signals | Brief was modern and minimal with no flashy color. A single restrained signal color keeps status legible without introducing a palette |
| 2026-08-25 | No AI chat pane in the main column                  | Competitor centers an assistant. Monadic centers the jobs; assistance is a side surface                                                |
| 2026-08-25 | Ingestion health is permanent sidebar furniture     | Silent zero-row pipeline failure is the product's main failure mode and must never be buried in settings                               |
| 2026-08-25 | Missing comp gets copy, not a dash                  | It is the common case, not an error state                                                                                              |
