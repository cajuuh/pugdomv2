# Contributing to Pugdom

Thanks for helping! Pugdom is an open-source Mastodon client built with Expo. Bug reports, fixes and features are all welcome.

## Finding something to work on

- Open work is tracked on the [project board](https://github.com/users/cajuuh/projects/4) and in [issues](https://github.com/cajuuh/pugdomv2/issues).
- Issues labelled **`good first issue`** are small and self-contained, and each one lists the files involved and a suggested fix.
- Comment on an issue to claim it before you start, so two people don't work on the same thing.

## Setup

Requirements: Node 22, [Yarn 1](https://classic.yarnpkg.com/) (the repo uses `yarn.lock`), and Xcode or Android Studio for native builds.

```bash
git clone https://github.com/cajuuh/pugdomv2.git
cd pugdomv2
yarn install
yarn ios       # or: yarn android / yarn web
```

The app uses a development build (`expo-dev-client`), not Expo Go. After changing `app.json` or native dependencies, regenerate the native projects with `npx expo prebuild --clean`.

This project targets **Expo SDK 56**. Check the versioned docs at https://docs.expo.dev/versions/v56.0.0/ rather than the latest ones, since APIs change between SDKs.

## Before opening a PR

```bash
yarn typecheck   # tsc, must report 0 errors
yarn test        # jest
```

The same checks run on every pull request (`.github/workflows/checks.yml`).

Tests live in `__tests__/`:
- Use `createTestQueryClient()` from `testUtils/queryClient.ts` for any component that uses React Query.
- Components rendered inside a `FlashList` must keep per-row state in `useRecyclingState`, because rows are recycled. There are tests for this in `__tests__/tootCard.test.tsx`.
- For a bug fix, add a test that fails without the fix.

## Branches, commits and PRs

- Branch off **`develop`** and open your PR against **`develop`**. `main` is the release branch.
- Name branches by type: `fix/…`, `feat/…`, `refactor/…`, `perf/…`, `chore/…`, `ci/…`.
- Commits use [gitmoji](https://gitmoji.dev/) (`gitmoji -c`), for example `🐛 Fix reply mentions for remote users` or `✨ Add hashtag timeline`. Use the same style for the PR title.
- In the PR description, say what changed and why, how you tested it (including anything checked on a device), and `Fixes #N` for the issues it closes.

## Native dependencies

Every merge into `develop` publishes an over-the-air update to the `preview` channel, and those updates reach builds that are already installed. A PR that adds a **native module imported from JS**, or upgrades one, would crash those builds. Call it out in the PR so it can ship together with a new native build. Pure JS changes are always fine.
