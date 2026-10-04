@AGENTS.md

# Gemini AI Context & Engineering Guidelines - Pugdom

This file is the single source of truth and prompt anchor for Gemini AI / Antigravity when assisting with the development of **Pugdom**, an Expo-based Mastodon client for iOS and Android.

---

## 🛑 Non-Negotiable Core Rules & Flow

### 1. Step-by-Step Execution
- **Never rush ahead across multiple phases or tasks autonomously.** Attack one task at a time.
- Always check the roadmap and active task note in the knowledge base before writing code.

### 2. User Verification on Device First
- **Every finished feature, bug fix, or task MUST be tested and verified by the user on their device / simulator first.**
- When implementation and local tests pass, provide the user with a concise, clear testing checklist:
  - What changed and what to expect on screen.
  - Exactly how to test the new functionality or edge cases on their running app.
- **Stop and wait for the user's feedback.** Do not assume completion until the user confirms the app works as intended.

### 3. User Approves and Merges Pull Requests
- **The AI NEVER merges pull requests.**
- The AI creates the feature branch, implements the code, runs typecheck and unit tests, pushes to GitHub, and opens the PR against `develop`.
- **The user is the sole person who reviews, approves, and merges the PR** after testing the build.

---

## 🧠 Knowledge Base: Obsidian Vault

The canonical knowledge base and task tracking system lives at:
📁 `/Volumes/PortableSSD/obsidian2/Linux/Projects/pugdom`

### Vault Structure & Files
- **`Tasklist.md`**: Master checklist tracking all completed (`[x]`) and open (`[ ]`) tasks across phases, with issue numbers, branches, completion dates, and PR links.
- **`Tasks/`**: Folder containing individual task specifications (e.g. `Tasks/Phase 7/Task - 51 - Explore.md`):
  - YAML frontmatter: `status` (`todo` | `in-progress` | `done`), `phase`, `branch`, `difficulty`, `github`, `pr`, `created`, `completed`.
  - Detailed task context, key files, approach, and checklist.
- **`Pugdom v2 Search, Timelines & Media Plan (2026-10-03).md`**: The active multi-phase roadmap for Search, Feeds, Lists, and Media (Phases 1–11).
- **Design Plans**: `Pugdom v2 Design Plan - Apricot Pug (2026-09-28).md` and related design references.

### Knowledge Base Protocol
1. **Before starting a task**: Read the corresponding note in `Tasks/` and the active plan in the vault. If no note exists, create one with the standard frontmatter and checklist.
2. **During the task**: Follow the approach laid out in the task note.
3. **When completing a task**: Update the frontmatter (`status: done`, `completed: YYYY-MM-DD`, `pr: ...`), check off all checklist items, and update `Tasklist.md`.

---

## 🔄 Development Flow & Skills (from .claude / plat-dev)

Follow this rigorous engineering flow on every task:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│ Investigate  │ ──> │ Spec & Plan  │ ──> │  Implement   │ ──> │ Verify Tests │ ──> │ User Test Run  │ ──> │ Open PR &    │
│ & Context    │     │  (Vault)     │     │ & TypeScript │     │ & Typecheck  │     │   on Device    │     │ User Merges  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └────────────────┘     └──────────────┘
```

1. **Investigate:**
   - Inspect existing components, types, services, and hooks.
   - Reference Mastodon API specifications: https://docs.joinmastodon.org/
   - Reference versioned Expo SDK 56 documentation: https://docs.expo.dev/versions/v56.0.0/
2. **Spec & Plan:**
   - Define exact requirements, state handling, network requests, cache keys, error states, and localization keys.
   - Sync with the Obsidian task note.
3. **Implement:**
   - Strict TypeScript (`tsc --noEmit`).
   - Use theme tokens from `services/themeContext.tsx` and typography tokens from `type` (zero color literals).
   - Localization: Always add keys to both `services/i18n/en.ts` and `services/i18n/pt-BR.ts`.
   - List recycling: FlashList rows must use `useRecyclingState` for per-item interactive state.
4. **Verify:**
   - Run `yarn typecheck` and ensure 0 errors.
   - Run `yarn test` and ensure all test suites pass. Use **Node 22** (CI's version); on Node 16 every suite fails with `FormData is not defined`.
   - Add unit and component tests for new features and regressions in `__tests__/`.
5. **User Test Run:**
   - Explain to the user what was added and how to test it in the running Expo dev client.
   - The app runs in pugdom's own development build, never in Expo Go (Expo Go is a different SDK and shows "Project is incompatible").
   - Await user verification.
6. **PR & Merge:**
   - Commit with [gitmoji](https://gitmoji.dev/) format (e.g. `✨ ...`, `🐛 ...`, `Fixes #N`).
   - Push feature branch to `origin`.
   - Open PR against `develop` using `gh pr create`.
   - **Do not merge.** Prompt the user to review and merge when satisfied.

---

## 🛠️ Tech Stack & Architecture

- **Framework:** Expo SDK 56 (React Native 0.85) targeting iOS and Android using development builds (`expo-dev-client`). App id `com.cajuuh.pugdom` on both platforms.
- **Native modules:** merges to `develop` ship OTA to installed builds of the same `expo.version` (runtime version). Adding a native module needs a version bump and a new build; never add one silently.
- **Package Manager:** Strictly `yarn` (`yarn.lock`). Do NOT use `npm` or `pnpm`.
- **State Management:**
  - Server state: TanStack Query (`@tanstack/react-query`) hooks in `hooks/`.
  - Client state: React Context (`services/authContext.tsx`, `services/themeContext.tsx`, `services/navigationContext.tsx`).
- **Storage:**
  - Sensitive data (access tokens, instance URLs): `expo-secure-store`.
  - Non-sensitive user preferences (coat theme, recent searches, pinned feeds): `@react-native-async-storage/async-storage`.
- **Lists:** `@shopify/flash-list` v2 for infinite scrolling timelines.
- **Git & Gitmoji:**
  - Branching off `develop`. PRs target `develop`. `main` is reserved for releases.
  - Commits follow `gitmoji -c` conventions (`✨` feature, `🐛` bug fix, `💄` UI/style, `♻️` refactor, `✅` tests, `🔧` config, `🌐` i18n, `📝` docs).
  - Every change goes through a PR into `develop`, including docs; don't push to `develop` or `main` directly.

---

## 🎨 Design System: Apricot Pug

- **Surfaces:** cards are solid (`colors.cardBackground`, hairline `borderColor`, a soft shadow in light mode only). The floating dock is the one glass surface (`BlurView` + translucent `tabBarBackground`; keep it translucent).
- **Coat Engine:** nine coats (Apricot, Fawn, Brindle, Black pug, Silver, Sage, Blueberry, Plum, Rose) defined in `services/theme/coats.ts`, light / dark / system mode and an optional "tint surfaces" setting, all consumed via `useTheme()` (`colors`, `type`, `coat`, `isDark`).
- **No Color Literals:** All colors come from `useTheme().colors` (or `mediaColors` in `services/theme/media.ts` for media overlays). Hardcoded hex codes (`#...`), `rgb()`, or named colors in `components/` and `screens/` are forbidden (guarded by `__tests__/noColorLiterals.test.ts`). Text and icons on surfaces use `accentText`; anything on an accent fill uses `buttonTextColor`.
- **Typography:** Fraunces (display: titles, wordmark) and Nunito (text) from `services/theme/typography.ts`, applied through `useTheme().type` (`title`, `sheetTitle`, `name`, `body`, `label`, `meta`).
- **Pug mark:** the logo is the author's one-eyed pug (`components/ui/pugMark.tsx`): the missing eye is a flat closed line on the viewer's right. Keep it in every pug drawing.
- **Floating Dock:** Bottom pill navigation bar isolated from screen edges with a central floating action button for compose.
- **Notifications:** rows grouped under Today / Earlier; every type uses the coat accent and is told apart by its badge glyph (mention @, favourite ★, boost ⟲, follow +); favourites and boosts of the same post are grouped.
