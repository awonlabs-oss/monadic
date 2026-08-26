# Monadic — Design System

This file governs all UI and UX decisions in **monadic**. It is authored by a human
from Figma mockups.

**If you are an agent working on this codebase: read this file before touching any
UI. Where it is silent, stop and ask. Do not fill gaps with defaults.**

---

## Status legend

Every section carries a status. Build only against DECIDED.

| Status | Meaning |
|---|---|
| **DECIDED** | Locked. Implement exactly as written. Deviations need approval. |
| **DRAFT** | Direction is set, details may shift. Confirm before relying on it. |
| **OPEN** | Not decided. Stop and ask. Do not proceed on assumption. |

Current overall state: **pre-design.** Almost everything below is OPEN. Application
routes may be built with structure and tokens only. The frontpage is blocked.

---

## 1. Principles

**Status: OPEN**

**Name:** monadic. Lowercase in code, URLs, and identifiers. Capitalized as "Monadic"
in prose and headings. Whether the wordmark is lowercase is a design decision — OPEN.

<!--
Three to five sentences on what this should feel like. Not adjectives — decisions.
"Dense over airy, because I'm scanning fifty postings, not reading one."
"Neutral chrome so company logos and comp figures carry the color."
"Every screen answers one question. If it answers two, it's two screens."
-->

_To be written._

---

## 2. Tokens

**Status: DRAFT (placeholders in place)**

All values live in `/design/tokens.json`. That file generates the Tailwind theme and
CSS custom properties. Component code references semantic token names only — never
raw hex, px, or arbitrary Tailwind values.

Tokens are **semantic, not literal.** `--color-surface-raised`, not `--gray-100`.
The palette will change; the names must survive it.

### Adding a token

A value with no token is a design gap, not a judgment call. Ask. Do not invent one.

### Current token groups

| Group | Prefix | Status |
|---|---|---|
| Color — surface | `color-surface-*` | placeholder |
| Color — content | `color-content-*` | placeholder |
| Color — border | `color-border-*` | placeholder |
| Color — accent | `color-accent-*` | placeholder |
| Color — status | `color-status-*` | placeholder |
| Spacing | `space-*` | placeholder |
| Radius | `radius-*` | placeholder |
| Typography | `font-*`, `text-*` | placeholder |
| Elevation | `shadow-*` | placeholder |

---

## 3. Typography

**Status: OPEN**

<!--
Typeface(s) and where each is used. The scale, as tokens, with the semantic role of
each step. Line heights. What weight means what.

Note especially: how do compensation figures and years-of-experience render? They're
scanned, not read. Tabular numerals?
-->

_To be written._

---

## 4. Layout

**Status: OPEN**

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

- [ ] JobCard — list item in the job feed
- [ ] JobDetail — full posting view
- [ ] FilterBar — role type, seniority, location, comp, freshness
- [ ] ApplicationRow — pipeline list item
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
- [ ] `/jobs` — job feed with filters
- [ ] `/jobs/[id]` — posting detail
- [ ] `/applications` — pipeline
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

| Situation | Frequency | Design |
|---|---|---|
| Compensation not listed | very common | OPEN |
| Years required not stated | very common | OPEN |
| No jobs match filters | common | OPEN |
| Company has no contacts yet | common at first | OPEN |
| Application has no events beyond creation | common | OPEN |
| Ingestion run failed for a company | occasional | OPEN |
| Resume parsed a field incorrectly | expected | OPEN |
| Job closed since it was saved | expected over time | OPEN |

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

| File | Depicts | Figma link | Exported |
|---|---|---|---|
| _(none yet)_ | | | |

Where a Figma file URL is available, pull design context directly from Figma rather
than working from the PNG. Match variable names and spacing exactly.

---

## 11. Decision log

Record what changed and why. Prevents relitigating and tells future-you what the
constraint actually was.

| Date | Decision | Reasoning |
|---|---|---|
| | | |
