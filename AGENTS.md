# Repository workflow

- `main` is the stable baseline. `develop` is the integration branch.
- After the initial repository import, start every implementation on a new `codex/<short-task>` branch based on the latest `develop`. Human-authored branches may use `feature/`, `fix/`, or `docs/`.
- Do not implement or commit routine changes directly on `main` or `develop`. Push the task branch and open a pull request targeting `develop`. Promote verified releases with a separate PR from `develop` to `main`.
- Fetch before branching when network access is available. Preserve unrelated local changes. Do not force-push shared branches, rewrite remote history, or reset user data.
- A request to implement a change authorizes its task branch, commits, push and reviewable PR. Merge only when the user's request includes merging or releasing.
- Use `npm run test:ci` and `npm run build` for portable checks. Run `npm test` and relevant Playwright journeys locally when the change affects CRM, conversations, memory, or P11. Full presentation generation tests require the separately configured Artifact runtime; never claim that the portable suite covers those operations.
- Never commit `.env`, API keys, runtime databases, local conversations/memory, uploads, or generated private reports. Run `npm run security:check` against staged changes before committing. Use `.env.example` for blank configuration.
- Keep product planning under `docs/`, Pencil sources under `designs/`, and mock knowledge/PPT assets under `knowledge/`. Update relevant documentation and describe validation in the PR.
- Do not run scenario reset or overwrite existing user-created CRM records as part of ordinary development or deployment.

Initial import exception: the first baseline commit may initialize an empty `main`, followed by creation of `develop` at the same revision.

## Pushing from this machine (Windows + proxy + DSH sandbox)

- Direct access to github.com is reset (`Recv failure: Connection was reset`). The machine uses a system proxy at `127.0.0.1:7897` (Clash-style), but **git does not read the Windows system proxy** — set it explicitly:
  ```powershell
  $env:HTTP_PROXY="http://127.0.0.1:7897"; $env:HTTPS_PROXY="http://127.0.0.1:7897"
  ```
- Inside the restricted DSH sandbox git cannot reach Windows credentials (`schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS`). Run `push` / `fetch` / `ls-remote` **outside the sandbox** (`danger-full-access`); credentials come from Git Credential Manager, no re-login needed.
- Self-check: `git -C . ls-remote --heads origin`. After pushing: `git fetch origin`, `git status -sb` shows no `ahead`, and `git log --oneline origin/<branch>..HEAD` is empty.
- Remote: `https://github.com/wavertao/Sales-Buddy.git`. Details and the same commands also live in the workspace-level `D:\AICRM\AGENTS.md`.
