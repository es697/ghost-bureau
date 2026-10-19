# 👻 Ghost Relocation Bureau

The operator console for a bureau that relocates ghosts out of old houses and into new haunts.
The system finds the best place for every ghost, explains the decision, shows who can't be relocated and why,
and warns the operator when they manually pick a bad option.

Styled as a "cursed Windows 95": beveled window frames, WordArt, a taskbar with a Start menu, a blue screen of death on failure.
Every ghost has a 16×16 pixel avatar. It's generated from the name, and the facial expression depends on anxiety:
the panickers tremble and stare wide-eyed. Special conditions add detail: glasses on the book-lover, drips on the damp-lover.
Animations can be turned off with the "Poltergeist" checkbox and are disabled automatically under `prefers-reduced-motion`.

- **Live demo:** https://es697.github.io/ghost-bureau/
- **Repository:** https://github.com/es697/ghost-bureau
- **AI Worklog:** the "🤖 AI Worklog" tab inside the app

## Quick start

Requires Node.js 18+.

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm test           # 35 tests for the matching core and validation
npm run build      # type check + production build into dist/
npm run preview    # view the built version
```

Deploy is automatic: on every push to `main`, GitHub Actions runs the tests, builds the project and publishes it to GitHub Pages ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). If tests fail, the site doesn't update.

No backend and no secrets. The bureau state lives only in page memory: every open and reload is a clean demo, so a reviewer always sees the same scenario. To keep your work, use "Export" to JSON; to restore it, use "Import".

## 60-second walkthrough

1. Open the app. The demo bureau is already loaded: 20 new requests and 9 places. The requests haven't been processed yet.
2. Click **"▶ Assign automatically"**. The bureau shows progress, then the result: how many were assigned and how many need an operator decision.
3. The **"Needs your decision"** list is the operator's main job. Each request shows a reason and a "What you can do" hint with an action button.
4. Pick a place for a request manually in the dropdown. If the pick is bad, a yellow warning appears listing the specific problems. A request with a place moves to **"Assigned"**: there you see the place, the score and the explanation, and manual overrides are marked "manual".
5. The **Report** tab: how many were assigned and how many are without a place, the most problematic requests, overloaded places.
6. The **"Check scenario"** menu in the header: ready-made states "Empty bureau", "Manual conflicts", "Broken file import".

## How matching works

The core is pure functions in [`src/engine`](src/engine); the UI only renders them.

**1. Hard requirements.** If even one is violated, the place doesn't fit:

| Rule | Rejection example |
|---|---|
| brightness ≤ 10 − anxiety | "too bright: brightness 8, with anxiety 7 the limit is ≤ 3" |
| \|place t − favorite t\| ≤ 10° | "too cold: 6° when the favorite is 20°" |
| place's anxiety cap | "the place doesn't accept anxiety above 6" |
| request's special conditions | needs an attic / basement, afraid of mirrors, no humans nearby, needs silence, loves damp (humidity from 60%), loves books |
| deadline not passed | "Deadline 2026-10-25 has already passed" |

**2. Score** = `100 − 2·|Δt°| − 2·light − round(noise·anxiety/5)`. It ranks the fitting places against each other, and every penalty is visible to the operator.

**3. Capacity-aware assignment.** New requests don't take places until the operator clicks "Assign automatically". From there a greedy algorithm runs:
- first the operator's manual overrides take free places. If the operator confirmed a move into an already occupied place, the current residents stay and the place becomes over capacity — that's the "overload";
- then the remaining requests in order: earlier deadline → fewer fitting places → higher anxiety (overdue ones go last);
- each request gets the place with the best score among those that still have free slots.

The `#N` on the card is the position in that queue.

Reasons a request is left without a place: `deadline passed`, `no fitting place` (with a per-place breakdown), `fitting places are occupied`, `the bureau has no places`.

Why the algorithm is greedy rather than optimal: the result is easy to explain to the operator ("a more urgent request beat you to it"). Optimal assignment (the Hungarian algorithm) is on the to-do list.

The bureau's "today" is stored in the data (2026-10-31 by default) and is changed in the header. Otherwise the demo would "go stale" over time: in a month every deadline would be overdue.

## Project structure

```
src/
  engine/             React-free core
    types.ts          data model
    rules.ts          all formula numbers and the condition catalog
    match.ts          scoring a "ghost × place" pair and assignment
    report.ts         final report
    validate.ts       form and import validation
    *.test.ts         tests (vitest)
  data/demo.ts        demo data and check scenarios
  data/worklog.ts     contents of the AI Worklog tab
  components/         tabs, forms, avatars (GhostAvatar), ErrorBoundary
  store.ts            bureau state and operator actions
```

## Pre-submission review checklist

Automated tests (`npm test`, 35 of them): the score formula, hard requirements and their boundaries, the empty list, a request without a place, overdue requests, capacity adherence, urgency priority, manual conflicts and overload, the final report, a broken import, strict dates.

Manual scenarios verified in the browser:

| # | Scenario | Steps | Expected result | ✓ |
|---|---|---|---|---|
| 1 | Empty request list | Scenario → "Empty bureau" | Clear empty states on every tab with "Add request" and "Load demo bureau" buttons; the report doesn't crash | ✅ |
| 2 | Request with no fitting place | Demo → "Assign automatically" → "Nervous Ned" | A red card "No place: no fitting place" and a rejection reason for each of the 9 places. Banshee Moira is also left without a place: she needs heat and silence at the same time | ✅ |
| 3 | Place over capacity | Scenario → "Manual conflicts" | Lighthouse 2/1: an "OVER CAPACITY" label on the "Places" tab, "Overloaded" in the report, a warning on both requests. When manually picking an occupied place, the bureau asks for confirmation first; the current residents stay put and the place becomes over capacity | ✅ |
| 4 | Manual pick conflicts with conditions | For "Auntie Dust", pick the theatre | A yellow block "Afraid of mirrors, and this one has mirrors" and a "Back to auto-match" button | ✅ |
| 5 | Fight for a place | Demo → "Assign automatically" → "Auntie Dust", "Damp Mary" | Auntie: "fitting places exist, but all are taken" — basement 2/2, chapel 3/3, mill 1/1 are taken by more urgent requests. Mary: "Best option — Chapel at the Graveyard (96) — already occupied", the castle was chosen | ✅ |
| 6 | Import error | Scenario → "Broken file import" | A red message listing the problems (anxiety 15, deadline "tomorrow", unknown condition, duplicate id, empty name, reference to a nonexistent place); the current data doesn't change | ✅ |
| 7 | Form validation | "+ Request" → "Save" with an empty name | An "Enter a name" error, the request isn't created; after entering a name the request appears and immediately gets a place | ✅ |
| 8 | Mobile layout | 375px width, all tabs and the form | No horizontal scroll, everything is reachable | ✅ |
| 9 | "Start" menu | Start → any item | Switches the tab or loads a scenario | ✅ |
| 10 | New requests and automatic assignment | Demo → "Assign automatically", then "+ Request" | Before the run every request is grey "Not processed", places are free, and the report says assignment hasn't been run. After: a progress window and the result "assigned 15 of 20", the "Needs your decision" list. A new request lands in "New" and waits for the next run | ✅ |
| 11 | Search and filters | "All" → search "auntie", then "castle"; the "Places" tab → filter "occupied", search "Keeper" | Finds case-insensitively; a place shows its residents; "Found N of M"; an empty result → "Reset search" | ✅ |
