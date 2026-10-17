# End-to-end flows (Maestro)

[Maestro](https://maestro.mobile.dev) drives the real app on a real device or
emulator: it taps what the user taps and asserts on what the user reads. It was
chosen over Detox because the flows are YAML, need no test-runner integration,
and no additional JS dependencies in the app bundle.

The flows are:

| Flow | What it proves |
| :--- | :--- |
| `smoke.yaml` | The app boots, a dev account signs in, and all five tabs mount and paint their own heading. |
| `delete-account.yaml` | Deletion is reachable from Settings, states its consequences, and its confirm button is gated behind typing `DELETE`. |

## One-time setup

Maestro is a standalone CLI, not an npm dependency:

```sh
# macOS / Linux (including WSL)
curl -Ls "https://get.maestro.mobile.dev" | bash
maestro --version
```

There is no native Windows build. On Windows run the flows from WSL, or from
Git Bash with the Linux binary.

## Before running

1. **A booted target.** An Android emulator (`adb devices`) or an iOS simulator.
   The dev client must already be installed — `npm run eas:build:dev --workspace
   pluto-mobile`, or `npx expo run:android` locally.
2. **A reachable API.** `EXPO_PUBLIC_API_URL` is inlined at build time, so the
   installed build must point at a host the device can reach. `localhost` is the
   *device's* localhost, not your machine's; use your LAN IP (see
   `scripts/dev-lan.mjs` in this workspace).
3. **Dev auth enabled.** Both flows use the dev-account button, which only
   renders under `__DEV__` and needs `ENABLE_DEV_AUTH=true` on the server.
   Against a non-production API that is fine; never enable it in production.

## Running

```sh
npm run e2e --workspace pluto-mobile          # every flow in .maestro
npx maestro test .maestro/smoke.yaml          # one flow
npx maestro studio                            # record/inspect while you build a flow
```

## Why this is not wired into `npm run test:e2e` at the root

The root `test:e2e` task fans out through Turborepo to every workspace that
defines it (today, the server's Jest e2e suite). Adding a mobile `test:e2e`
would put Maestro on that graph, and Maestro needs an emulator and a built dev
client — neither of which exists in the CI image. That would make the root
command fail for everyone who has not set up a device. The flows are therefore
run deliberately, by name, and this file is the checklist for doing so.
