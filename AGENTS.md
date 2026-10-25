<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Environment Notes

- **Platform**: Windows (win32). Do not use Linux/macOS shell commands (e.g., `rm`, `cp`, `mv`, `grep`, `find`, `sed`, `awk`, `cat`, `ls` with Unix-specific flags). Use Windows equivalents (PowerShell/cmd) or the provided tools (`read`, `write`, `edit`, `glob`, `grep`).
- **Shell**: Prefer PowerShell commands when using the shell tool. File paths use backslashes on Windows.
- **Tools over shell**: Use the dedicated tools (`read`, `write`, `edit`, `glob`, `grep`) instead of shell commands whenever possible.
- **Windows shell gotchas**: `head`, `tail`, `grep`, `sed`, `awk`, `cut`, `xargs` are not available in cmd/PowerShell by default. Use PowerShell cmdlets (`Get-Content`, `Select-Object`, `Select-String`) or just `type`/`more`. Piping through non-existent Unix tools will fail. Don't chain with `| head -n N`. For reading file tails/heads, use `Get-Content <file> -TotalCount N` or read ranges.

# Project Notes

- **Package manager**: npm (workspaces). Use `npm install` at root. Use `-w <workspace>` or `--workspace` for scoped commands.
- **Monorepo**: Turborepo with apps in `apps/` and shared packages in `packages/`. Prefer running tasks via `turbo` (`npm run dev/build/lint/test` at root) to use caching/dependency ordering.
- **Environment**: Never commit `.env*` files. See `docs/ENVIRONMENTS.md` and per-app `.env.example` files. Each environment (dev/staging/prod) must use separate DB/secrets.
- **Database**: Prisma in `apps/server`. When changing schema, update migrations and run/typecheck as needed. Follow existing patterns in `apps/server/prisma/`.
- **Code style**: Follow existing patterns in the surrounding files. Prefer editing existing files over creating new ones unless necessary.
- **Tests**: Server has Jest unit + e2e; web has its own test setup. Run via `npm run test` or workspace-scoped scripts.

# Safety

- **Secrets**: Do not read or print secrets from `.env` files. Use `.env.example` for references.
- **Migrations**: Be careful with destructive Prisma migrations; check existing migrations first.


