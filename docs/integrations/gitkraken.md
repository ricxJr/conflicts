# GitKraken integration

GitKraken's support for arbitrary external merge tools is limited to a list of
tools it recognizes, so the guaranteed path is the standard Git flow (spec
§20).

## Recommended flow (always works)

1. Configure MergeScope globally for Git — see [git.md](git.md) or run
   `scripts/setup-git-mergetool.ps1`.
2. When GitKraken reports a conflict:

```text
GitKraken
→ Open Terminal (built-in, opens at the repo/worktree root)
→ git mergetool
→ MergeScope opens
→ resolve → Save & Close
→ back to GitKraken: the file shows as modified/resolved
```

This works from any worktree GitKraken has open, because MergeScope resolves
the git context from the file location.

## Direct integration

If your GitKraken version lists external merge tools (Preferences → Git →
Merge tool) and offers _"Use Git's configured tool"_ or an equivalent option,
selecting it will launch MergeScope directly once the global Git configuration
is in place.

Deeper first-class integration (tool listed by name inside GitKraken) depends
on GitKraken's own registry of tools and is tracked as a future adapter — the
core app intentionally does not depend on it (ADR-001/ADR-002).
