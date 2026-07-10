# Fork integration

Fork (git-fork.com) supports custom external merge tools.

## Configuration

1. Open **Fork → Preferences → Integration** (Git section).
2. Set **Merge tool** to _Custom_ and fill in:

```text
Executable:
C:\Program Files\MergeScope\MergeScope.exe

Arguments:
--base "$BASE" --current "$LOCAL" --incoming "$REMOTE" --result "$MERGED" --wait
```

> Fork uses the same `$BASE/$LOCAL/$REMOTE/$MERGED` placeholders as
> `git mergetool`. If your Fork version names them differently, map them
> accordingly — MergeScope also accepts `--local/--remote/--merged` aliases.

Alternatively, configure Git globally
(see [git.md](git.md) or run `scripts/setup-git-mergetool.ps1`) and let Fork
use the default Git merge tool.

## Flow

```text
Fork
→ conflicted file
→ Open in External Merge Tool
→ MergeScope opens with the three-way view
→ resolve → Save & Close
→ Fork detects the updated file
→ mark resolved / stage in Fork
```

MergeScope never stages the file itself; confirm the resolution in Fork as
usual.
