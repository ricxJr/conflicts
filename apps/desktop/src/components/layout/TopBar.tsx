import { useSession } from "../../stores/session";
import type { Preferences } from "../../types/session";

const THEMES: Preferences["theme"][] = ["dark", "light", "system", "high-contrast"];

export function TopBar() {
  const session = useSession((s) => s.session);
  const groups = useSession((s) => s.groups);
  const unresolved = useSession((s) => s.unresolvedCount);
  const prefs = useSession((s) => s.prefs);
  const setPrefs = useSession((s) => s.setPrefs);
  const setPaletteOpen = useSession((s) => s.setPaletteOpen);

  const fileName = session?.files.result.fileName ?? "";
  const operation = session?.git?.operation ?? "merge";
  const worktree = session?.git?.worktreeRoot;
  const title = session?.cli.title;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="brand">MergeScope</span>
        <span className="topbar-file" title={session?.files.result.path}>
          {title ?? fileName}
        </span>
        {operation !== "unknown" && <span className="badge badge-op">{operation}</span>}
        {worktree && (
          <span className="topbar-worktree" title={worktree}>
            {worktree.split(/[\\/]/).slice(-2).join("/")}
          </span>
        )}
      </div>
      <div className="topbar-right">
        <span className="topbar-conflicts" aria-live="polite">
          {groups.length - unresolved}/{groups.length} resolved
        </span>
        <label className="toggle" title="Collapse unchanged regions in the diff panels">
          <input
            type="checkbox"
            checked={prefs.hideUnchangedRegions}
            onChange={(e) => setPrefs({ hideUnchangedRegions: e.target.checked })}
          />
          Changes only
        </label>
        <label className="toggle" title="Ignore whitespace-only differences">
          <input
            type="checkbox"
            checked={prefs.ignoreWhitespace}
            onChange={(e) => setPrefs({ ignoreWhitespace: e.target.checked })}
          />
          Ignore WS
        </label>
        <label className="toggle" title="Pin the base file as a third panel">
          <input
            type="checkbox"
            checked={prefs.showBasePanel}
            onChange={(e) => setPrefs({ showBasePanel: e.target.checked })}
          />
          Base
        </label>
        <label className="toggle" title="Show the conflict list sidebar">
          <input
            type="checkbox"
            checked={prefs.showConflictList}
            onChange={(e) => setPrefs({ showConflictList: e.target.checked })}
          />
          List
        </label>
        <select
          className="theme-select"
          value={prefs.theme}
          aria-label="Theme"
          onChange={(e) => setPrefs({ theme: e.target.value as Preferences["theme"] })}
        >
          {THEMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          className="palette-button"
          onClick={() => setPaletteOpen(true)}
          title="Command Palette (Ctrl+Shift+P)"
        >
          ⌘
        </button>
      </div>
    </header>
  );
}
