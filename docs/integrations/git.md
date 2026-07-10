# Git integration

MergeScope implements the standard `git mergetool` external-tool contract
(RF-001, spec §17): Git hands it the four files (`$BASE`, `$LOCAL`, `$REMOTE`,
`$MERGED`) and interprets the process exit code.

## Global configuration (Windows)

```bash
git config --global merge.tool mergescope

git config --global mergetool.mergescope.cmd \
  '"C:/Program Files/MergeScope/MergeScope.exe" --base "$BASE" --current "$LOCAL" --incoming "$REMOTE" --result "$MERGED" --wait'

git config --global mergetool.mergescope.trustExitCode true
git config --global mergetool.prompt false
git config --global mergetool.keepBackup false
```

Equivalent `.gitconfig` block:

```ini
[merge]
    tool = mergescope

[mergetool "mergescope"]
    cmd = "\"C:/Program Files/MergeScope/MergeScope.exe\" --base \"$BASE\" --current \"$LOCAL\" --incoming \"$REMOTE\" --result \"$MERGED\" --wait"
    trustExitCode = true

[mergetool]
    prompt = false
    keepBackup = false
```

> Adjust the executable path if you built from source
> (`apps/desktop/src-tauri/target/release/mergescope.exe`) or installed to a
> custom location. The `scripts/setup-git-mergetool.ps1` helper applies all of
> the above for you.

## Usage

```bash
git mergetool                                # all conflicted files, one at a time
git mergetool src/services/OrderService.ts   # a specific file
```

With `trustExitCode = true`:

- **Save & Close (exit 0)** → Git marks the file resolved (staging remains a
  separate, explicit `git add`, per spec §26).
- **Cancel / close without saving (exit 1)** → the conflict stays pending.

## Exit codes

| Code | Meaning                                  |
| ---: | ---------------------------------------- |
|    0 | Result saved successfully                |
|    1 | Canceled or unresolved conflicts left    |
|    2 | Invalid arguments                        |
|    3 | Read failure                             |
|    4 | Write failure                            |
|    5 | Internal merge engine failure            |
|    6 | File changed externally during a session |

## Rebase and cherry-pick

MergeScope labels the panels **Current** and **Incoming** (not "ours/theirs"
or "mine/other"), because the meaning of `LOCAL`/`REMOTE` flips between merge,
rebase and cherry-pick. The in-progress operation (detected from the git dir,
worktree-aware) is shown in the top bar.

## Worktrees

Each MergeScope process is fully independent — no shared global state — so
multiple instances can resolve conflicts in different worktrees at the same
time. Detection handles `.git` being a _file_ (worktree pointer) as well as a
directory.

## Diagnostics

```bash
mergescope doctor
```

Checks Git availability, the configured merge tool, executable path, write
permissions and the WebView2 runtime.
