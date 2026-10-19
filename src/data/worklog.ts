/**
 * AI Worklog — shown on the "AI Worklog" tab.
 * Lines starting with TODO are highlighted in the UI as not yet filled in.
 */

export const START_PROMPT = `You are a Senior Fullstack & AI-First Engineer. Our task is to build from scratch and prepare for deployment a complete web app, "Ghost Relocation Bureau", for the MOX Studio test assignment.

STACK: Vite + React 18 + TypeScript (strict), custom CSS with no UI libraries, Vitest. No backend: state lives in page memory, persistence via JSON import/export. Interface in English.

ARCHITECTURE: a pure matching engine in src/engine (types, rules, matching, report, validation) with no React — the UI only renders the result.

LOGIC:
- Hard requirements reject a place with a concrete reason: light <= 10 — anxiety, a temperature difference <= 10 degrees, the place's anxiety limit, the request's special conditions (attic, basement, mirrors, humans, silence, damp, books), an overdue deadline, a closed place.
- Score 0-100 = 100 - penalties (temperature, light, noise * anxiety); every penalty is visible to the operator.
- Assignment respects capacity: manual overrides first, then the queue "earlier deadline -> fewer options -> higher anxiety".
- Compute deadlines from the "bureau date" stored in the data, not from the real date — otherwise the demo goes stale.

REQUIRED STATES: empty, no suitable place, over capacity (only via a manual pick), manual conflict, a clear error (a broken import that breaks down every problem, a render crash). Each one reachable in one click from the scenarios menu.

QUALITY: core tests before the UI; after every step check the result in the browser yourself; at the end, an independent review by a separate agent. Don't invent: if something isn't there, say so.

first break down the spec and find the pitfalls, code after that`;

/** Local time, 14.10.2026 */
export interface Prompt {
  at?: string;
  text: string;
  /** What was done in response to this message */
  result?: string;
}

export interface WorklogStage {
  title: string;
  time: string;
  me: string;
  ai: string;
  prompts: Prompt[];
}

export interface Stamped {
  at: string;
  text: string;
}

export const WORKLOG = {
  date: '14.10.2026',
  tools: [
    'Claude Code (the Claude desktop app) — most of the work, model Claude Opus 5.5',
    'Claude Fable 5.1 — switched to it for the final checks (12:59 and 15:19)',
    'Claude Sonnet 5.5 — briefly, while editing the copy (13:22)',
    'Separate reviewer agents inside Claude Code — two independent code reviews',
  ],
  totalTime:
    '≈ 4 h per the session log (12:29–16:50): about an hour for the first working version and checking it, the rest for fixes after the live test, the review, the Worklog and the deploy',
  tokens:
    "Session context ≈ 760k tokens (Claude Code indicator) + ≈ 270k for the two reviewer agents. The tool doesn't show total usage across all requests; against plan limits it's 38% of the five-hour window.",

  highlights: [
    '35 core unit tests (vitest)',
    '2 independent reviews: 10 logic bugs and 4 visibility issues — all fixed',
    '5 required states + one-click test scenarios',
    '0 console errors across all scenarios',
  ],

  stages: [
    {
      title: '1. Breaking down the spec',
      time: '12:29–12:30',
      me: 'Wrote the starting prompt with the spec: stack, architecture, matching rules, required states and quality requirements. Asked to break down the spec and find the pitfalls first, and write code after that. After the breakdown we decided to do everything locally and leave the deploy for the end.',
      ai: 'Broke the spec down into its mandatory points and found the non-obvious ones. Every finding became part of the product: (1) deadlines from the real date would go stale within a month, so the "bureau date" is stored in the data and editable in the header; (2) auto-assign will never overfill a place, so "over capacity" is only reachable through a manual pick — hence the "Manual conflicts" scenario; (3) a "clear error" has to actually happen, so there\'s a JSON import that breaks down every problem plus a "Broken file import" scenario; (4) the scenario has to be understood in a minute: there\'s a "How to use in a minute" tip and a test-scenario switcher.',
      prompts: [{ at: '12:29', text: START_PROMPT }],
    },
    {
      title: '2. Architecture and environment',
      time: '12:30–12:33',
      me: "Asked the AI to suggest several stack options and say whether a backend is needed here. Picked the simplest option, one that's easy to run and deploy. There was no Node.js on the machine, so I chose an install that didn't change anything in the system.",
      ai: "Argued that no backend was needed and proposed Vite + React + TypeScript: the matching engine separate from the UI, JSON import/export. Installed Node 24 LTS into the home folder and verified the archive's checksum.",
      prompts: [
        { at: '12:30', text: 'suggest a couple of stack options for this task and why. do we even need a backend here?' },
        { at: '12:30', text: "let's do everything locally first and check it, deploy later" },
      ],
    },
    {
      title: '3. Matching logic',
      time: '12:33–12:37',
      me: "Asked the AI to lay out the matching options with pros and cons and chose myself. A hard filter plus a score, so every rejection has a clear reason. A greedy algorithm instead of an optimal one, because it's easier to explain to the operator. Deadlines are computed from the bureau date, not today's date.",
      ai: 'Offered options at every fork and implemented the chosen ones: a condition conflict rejects a place with a reason, temperature, light and noise lower the score, the queue is "earlier deadline → fewer options → higher anxiety". Built the demo data so that it contained every required state. The core tests were written before the UI.',
      prompts: [
        { at: '12:33', text: "what options are there at all for how to do the matching? lay out the pros and cons, I'll pick" },
        { at: '12:33', text: "let's go hard filter plus score. if a place doesn't fit, there should always be a concrete reason why, not just a low score" },
        { at: '12:34', text: 'make the penalties visible individually, so the operator can see what the score was docked for' },
        { at: '12:34', text: "skip the optimal algorithm, greedy is fine. you have to explain to the operator why their ghost ended up in the wrong place, and you can't explain the Hungarian algorithm. but make the queue smart: whoever's more urgent and has fewer options goes first" },
        { at: '12:35', text: 'if the best place got taken, say so in the explanation, like requests earlier in the queue took it' },
        { at: '12:35', text: "compute deadlines not from today but from the bureau date, and make it editable in the header. otherwise in a month the whole demo will be overdue" },
        { at: '12:36', text: "build the demo data so it already has all the required states from the spec, the reviewer shouldn't have to create anything by hand" },
        { at: '12:36', text: 'show the formula right in the UI, briefly, so it makes sense in a minute' },
        { at: '12:37', text: 'core matching tests first, UI after' },
      ],
    },
    {
      title: '4. Interface and style',
      time: '12:37–13:09',
      me: 'I wanted the app to be memorable, so I picked a 90s horror-game style. The first version was atmospheric, but the text was hard to read in it, and there\'s a lot of text here. Asked for several options on one card and picked "cursed Windows 95": it reads well and looks like an old computer at the bureau. Figured out how to play with it: the window title bar colour shows the status, errors look like a blue screen, the Start menu actually works. Came up with avatars for the ghosts: the face depends on anxiety, the details on the conditions, overdue ones go pale. At the end I removed the extra animation, changed the heading font and made a single checkbox that turns off all the effects.',
      ai: 'Showed 4 style options on one card. Rebuilt the interface in Win95: windows, tabs, the Start menu, a blue screen of death as the error screen. Generated pixel avatars from the name, anxiety and conditions. For the headings, compared pixel fonts with Cyrillic support and picked Tiny5.',
      prompts: [
        { at: '12:37', text: 'can we do the graphics in the style of some 90s horror game? I want it to be memorable' },
        { at: '12:46', text: "something's off. atmospheric but hard to read, and we've got a lot of text with explanations. show me a few options on one card, I'll pick" },
        { at: '12:49', text: "let's do cursed Win 95. make the request status visible in the window title bar colour, errors as a blue screen, and make Start actually work" },
        { at: '12:49', text: 'and make avatars for the ghosts. the face should depend on anxiety, the details on the conditions, and make the overdue ones pale' },
        { at: '12:52', text: 'tabs like in the Windows properties window, and a taskbar at the bottom with Start and the bureau date on the right' },
        { at: '12:53', text: 'make the warnings look like Windows system dialogs, with the little X and exclamation-mark icons' },
        { at: '12:54', text: "if you click the X on a window, make it say something like the ghosts won't let go, instead of just nothing" },
        { at: '12:56', text: 'too many top hats and the colours are all kind of the same and washed out. mix it up' },
        { at: '12:57', text: 'in the add form, make the avatar render live while you type the name' },
        { at: '13:08', text: 'remove the motion on the heading, it distracts. and make the font there more Win95' },
        { at: '13:09', text: 'put all the animations behind a single checkbox so they can be turned off' },
      ],
    },
    {
      title: '5. Debugging along the way',
      time: '12:40–13:00',
      me: 'Asked the AI to open the app itself after every change and check the result, not just run the tests. Based on the results I decided which fixes to accept.',
      ai: 'Checked every change in the browser and found: a font missing the Cyrillic letters O and P; the "Auto" label pointed at a different place than the one it was actually assigned to; an overdue request sat first in the queue; clumsy copy like "out of 1 suitable places". Fixed everything before I even saw it.',
      prompts: [{ at: '12:40', text: 'after every change, open the browser yourself and check, write down what you found' }],
    },
    {
      title: '6. Final check',
      time: '12:59–13:06',
      me: "I didn't take the green tests on faith: the same AI wrote the code and the tests, so their mistakes can overlap. Switched to a different model, Claude Fable 5.1, and wrote a detailed prompt-checklist for it: where to look for bugs, which scenarios to run in the browser and in what form to send back findings. Asked that every fixed bug be closed with a test. Handed the review to a separate agent that didn't write this code.",
      ai: 'The reviewer agent went through the code against the checklist and found 10 bugs that both the code\'s author and the tests had missed. The most serious: corrupted data was silently overwritten by the demo set, a closed place was counted as "occupied", duplicate conditions produced a double penalty. All fixed, plus 6 tests to keep these bugs from coming back. In parallel, ran all the scenarios live in the browser, including deleting every place, forms with garbage data and an artificial crash to test the blue screen.',
      prompts: [
        {
          at: '12:59',
          text: "check everything before handing it in, thoroughly. 1) spin up a separate agent to review the code, real bugs only, style not needed. look at: capacity and manual overrides, empty data and deleted places, what import validation lets through, react keys and effects, the copy in Russian. for each bug, the file, the line and a sample of the data it breaks on. 2) in parallel run all the scenarios in the browser yourself: empty, no place, over capacity, manual conflict, broken import, deleting every place, forms with garbage, phone. 3) fix everything you find and close it with a test",
          result: '10 bugs found and fixed, +6 tests',
        },
      ],
    },
    {
      title: '7. Deploy',
      time: '13:54–14:30, update 15:44–15:50',
      me: 'Before publishing I asked it to check that nothing extra would land in the repository: drafts, service files, personal data. Chose GitHub Pages with auto-deploy, so the site updates itself and only if the tests pass. I signed in to GitHub myself through the browser and never handed tokens into the chat.',
      ai: 'Created a public repository and wrote the GitHub Actions: tests, build, publish to Pages. Checked that the build was green and the site opens, and added the links to the README.',
      prompts: [
        { at: '13:54', text: "let's deploy. need a public repository and a link that opens for anyone without installing anything" },
        { at: '13:56', text: 'make the deploy run automatically on push and only if the tests are green' },
        { at: '14:09', text: 'before the push check that nothing extra is flying into the repo: drafts, service files, personal data' },
        { at: '14:28', text: 'add the links to the readme and fill in the deploy stage in the worklog' },
      ],
    },
    {
      title: '8. Fixes after the live test',
      time: '14:35–16:50',
      me: "Went through the deployed version myself as a reviewer and wrote down everything that got in the way. The main thing: rebuilt the operator flow — new requests → \"Assign automatically\" → \"Needs your decision\" with a hint on what to do. Removed what isn't in the spec or contradicts the point of the task: splitting conditions into mandatory and optional, advice to bend a request to fit a place, evicting residents on a manual placement. Decided that refreshing the page always opens a clean demo.",
      ai: 'Made a fix for every remark, checked the result in the browser after each one and closed it with tests. At my request ran a second independent review of the placement logic: no bugs in the engine, 4 visibility issues found — all fixed. Below is the log: the time of the remark and what was done.',
      prompts: [
        { at: '14:35', text: 'after picking a scenario the dropdown still says "select", but it should show the row you picked. make the little calendar in the date picker Win 95 too. and style the delete dialog to match', result: 'the list shows the loaded scenario, a custom calendar and a Win95-style delete dialog' },
        { at: '14:38', text: 'the special conditions in the request form overlapped the frame', result: 'the group caption sits on the frame, Win95-style' },
        { at: '14:40', text: 'why are some conditions mandatory and some optional? the spec has nothing like that. make it like the spec', result: 'all special conditions behave the same: a conflict excludes a place with a reason' },
        { at: '14:43', text: "temperature can go below -30, I'd make it -90 to +60", result: 'range −90…+60 °C in the forms and import' },
        { at: '14:49', text: "the filters are confusing. the manual ones are in fact assigned too. the operator's main job is to assign the unassigned, so the list of those without a place should come first. no need for a separate manual list, just highlight them", result: 'the unassigned list comes first, the "Manual" filter is gone, manual ones are marked on the card' },
        { at: '14:52', text: "the red number on the tab says 5 decisions are needed. but you go there and it's unclear what next, hint at what to do", result: 'a hint above the list and a "What you can do" block with a button on each card' },
        { at: '14:56', text: "when the demo opens everything's already assigned without me doing anything, it's unclear what's required of me. let's start with unprocessed requests: the operator hits assign automatically, the little gears spin, some get assigned, the rest land in needs a manual placement", result: 'new requests, an "Assign automatically" button, a progress window and a summary' },
        { at: '15:01', text: 'does editing a request even match the spec? how logical is it to edit a request at all', result: 'the hints no longer suggest editing a request; an overdue one can be rejected' },
        { at: '15:06', text: "I refresh the page and everything's already assigned. make it a clean demo every time", result: 'state no longer persists across refreshes; you can save your work via "Export"' },
        { at: '15:11', text: "let's make more ghosts and correspondingly more houses", result: '20 ghosts and 9 places, ending up with all three "no place" reasons' },
        { at: '15:18', text: "let's change the Ghost Relocation Bureau title. leave it as it was, just make the colour neutral, in the Win95 palette", result: 'the title in the blues of Win95 window title bars' },
        { at: '15:20', text: 'run the tests, check the placement logic, the app logic in general, compare with the spec', result: 'second review: engine bug-free, 4 visibility issues fixed; the report now separates "overloaded" and "demand exceeds capacity"' },
        { at: '15:26', text: 'I managed to squeeze 4 into the lighthouse, and it holds 1. make it ask for confirmation', result: 'an occupied place only through a confirmation dialog' },
        { at: '15:31', text: "in the dropdown for a manual placement it doesn't always say there's no room", result: 'occupancy is visible for every place in the list' },
        { at: '15:39', text: 'why are some icons grey and some coloured?', result: 'all the icons now show as coloured emoji' },
        { at: '16:02', text: "check that when it goes over capacity it doesn't evict the previous residents", result: 'residents stay put and the place honestly becomes over capacity' },
        { at: '16:05', text: "the breakdown for a no-place request doesn't say that a place is occupied", result: 'occupancy is visible for each place in the breakdown' },
        { at: '16:07', text: 'add to the worklog a checklist of the scenarios I checked before handing it in', result: 'checklist below' },
        { at: '16:32', text: 'the report says "only one place fits" — so why isn\'t it there? the wording needs improving', result: "the request is housed and nothing's threatening it, so it was removed from the \"problem\" list entirely" },
        { at: '16:37', text: "let's drop deleting places. doesn't that contradict the spec?", result: "it doesn't contradict it: places can be added and edited (capacity 0 means \"closed\"), and deleting silently dropped residents and manual overrides" },
        { at: '16:40', text: 'maybe turn all conditions into plus/minus adjustments to the score instead of some of them into a hard filter? a single mechanism, below the threshold — manual only', result: 'discussed it and kept it as in the spec: hard requirements answer "can you be here at all", the score answers "which of the suitable ones is better"; in a single score a good temperature would outweigh a ban, and "manual only" already exists' },
        { at: '16:42', text: 'in "what to improve" add a role model: a ghost files and edits its own request, a city administrator manages places, the operator only assigns', result: 'added to the improvements list below' },
        { at: '16:44', text: "let's compare the tests and the logic with the spec once more", result: 'the logic matches the spec on every point; removed a duplicate test, added a boundary test (light, temperature, deadline today) and a test for the final report' },
        { at: '16:48', text: 'requests and places need search and filtering', result: 'requests — search by name or place and a filter by special condition; places — search by name or resident, filters "free / occupied / over capacity / closed" and by feature' },
      ],
    },
  ] satisfies WorklogStage[],

  checklist: {
    at: '16:50',
    note: 'Ran through the browser from a clean slate before handing it in. Detailed steps and expected results are in the README.',
    items: [
      'Empty request list → a clear empty state with "Add request" and "Load demo bureau" buttons',
      'New requests → "Assign automatically" → progress window → summary "15 of 20 assigned" → "Needs your decision" list',
      'A request with no suitable place (Nervous Ned, Banshee Moira) → a reason for each place with its occupancy',
      'Suitable places are taken (Auntie Dust) → a list of the occupied places and an "Open places" hint',
      'Overdue deadline (Oswald, Byron the Poet) → the reason and a "Reject request" button with confirmation',
      'A manual pick with a conflict → a yellow block with the concrete violations and "Back to auto-assign"',
      'An occupied place picked manually → a confirmation dialog, residents stay, the place is "OVER CAPACITY" in the place list and the report',
      'Error: broken file import → a list of concrete problems, current data unchanged',
      'Render error → a blue screen with "Try again" and "Restart" buttons',
      'Searching "auntie" (case- and diacritic-insensitive) and "castle" finds requests; the places filter "occupied" and searching for a resident in places work; an empty result → "Reset search"',
      "Forms with empty and invalid values → field-level errors, the request isn't saved",
      'Refreshing the page → a clean demo; phone at 375px — no horizontal scroll',
    ],
  },

  myDecisions: [
    { at: '14:49', text: 'Build the interface around the operator\'s work: new requests and an "Assign automatically" button first, then the list of those needing a decision, with the reason and a hint on what to do.' },
    { at: '12:46', text: 'At every fork ask the AI for options and choose myself: stack, algorithm, design. That\'s how "cursed Windows 95" and the ghost avatars came about.' },
    { at: '15:01', text: 'Be honest with the operator: every rejection has a reason, we don\'t bend a request to fit a place, and moving into an occupied place only with confirmation and without evicting the current residents.' },
    { at: '12:29', text: 'Stick to the spec: start by breaking down the assignment, make the special conditions as in the spec with no invented mechanics, and show the reviewer the same clean demo on every open.' },
    { at: '12:59', text: 'Verify in two loops: the AI checks every step in the browser itself, and before handing in, another model does an independent review. The two reviews found 10 bugs and 4 visibility issues.' },
  ] satisfies Stamped[],

  aiMistakes: [
    { at: '15:01', text: 'Tried to solve the problem by bending the request to fit the place: "extend the deadline", "change the request conditions". That contradicts the point of the task — the conditions and deadline belong to the client. I caught it, we removed it.' },
    { at: '14:40', text: 'Added a mechanic that isn\'t in the spec: split the special conditions into mandatory and optional. This was confusing for the operator — I caught it in the live test, we put it back as in the spec.' },
    { at: '14:56', text: 'On open it immediately showed an already-assigned bureau: unclear what happened and what\'s required of the operator. I caught it — now the operator starts the assignment themselves.' },
    { at: '15:20', text: 'A manual pick of an occupied place silently evicted whoever auto-assign had placed there. The second review found it; I decided no eviction at all — now the bureau asks for confirmation, the residents stay, and the place becomes over capacity.' },
    { at: '15:31', text: 'In the manual pick list it didn\'t show that a place was taken if the place had a conflict. I caught it — now occupancy is visible for every place.' },
    { at: '13:00', text: 'Corrupted data in the browser was silently overwritten by the demo set. The first review found it; later we removed persistence across refreshes entirely.' },
    { at: '13:00', text: 'A closed place (capacity 0) was counted as "suitable but occupied" — hence the false explanation "requests earlier in the queue took the place".' },
    { at: '12:45', text: 'The "Auto: …" label showed the best place by score, not the one it was actually assigned to.' },
    { at: '12:40', text: 'Picked a pixel font missing the Cyrillic letters O and P — the letters in the headings came out mixed from two fonts.' },
  ] satisfies Stamped[],

  manualChanges: [
    'Didn\'t write code by hand. Set tasks, chose from the options, checked the result and rejected what didn\'t fit.',
    'Went through the app myself as a reviewer and, based on my own remarks, rebuilt the main flow: new requests → "Assign automatically" → "Needs your decision".',
    'Rejected the first design version and picked a new direction from the options. Polished the interface based on my own remarks: the calendar and delete dialog in Win95 style, the title, the hints, the place list.',
  ],

  improvements: [
    'An AI assistant for the operator: explains decisions in plain language and answers questions like "why not there?". The decision itself stays with the deterministic algorithm — it\'s predictable and testable.',
    'A backend and a shared database instead of page memory — so several operators see the same data.',
    'A role model: a ghost only files and edits its own request; a city administrator adds, deletes and edits places; the operator only assigns requests to places. Right now one operator does all of it.',
    'Optimal assignment (the Hungarian algorithm) instead of greedy — to maximise the total score. Greedy was kept for the sake of explaining it simply to the operator.',
    'Configuring the formula weights right in the UI and an action history with undo.',
    'UI tests (Playwright) in CI, not just core tests.',
    'Load the Tiny5 font locally so the headings don\'t depend on Google Fonts without internet.',
  ],
};

export const isTodo = (s: string) => s.startsWith('TODO');
