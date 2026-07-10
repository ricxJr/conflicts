import { useTranslation } from "react-i18next";
import { useSession } from "../../stores/session";
import type { ThemeName } from "../../types/session";
import { effectiveKeybindings, formatChord } from "../../features/keybindings";

const THEMES: ThemeName[] = ["dark", "light", "system", "high-contrast", "custom"];

export function TopBar() {
  const { t } = useTranslation();
  const session = useSession((s) => s.session);
  const groups = useSession((s) => s.groups);
  const unresolved = useSession((s) => s.unresolvedCount);
  const prefs = useSession((s) => s.prefs);
  const setPrefs = useSession((s) => s.setPrefs);
  const setPaletteOpen = useSession((s) => s.setPaletteOpen);
  const setSettingsOpen = useSession((s) => s.setSettingsOpen);

  const fileName = session?.files.result.fileName ?? "";
  const operation = session?.git?.operation ?? "merge";
  const worktree = session?.git?.worktreeRoot;
  const title = session?.cli.title;

  const kb = effectiveKeybindings(prefs.keybindings);
  const paletteChord = kb.palette ? ` (${formatChord(kb.palette)})` : "";

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
          {t("topbar.resolved", { resolved: groups.length - unresolved, total: groups.length })}
        </span>
        <label className="toggle" title={t("topbar.changesOnlyTitle")}>
          <input
            type="checkbox"
            checked={prefs.hideUnchangedRegions}
            onChange={(e) => setPrefs({ hideUnchangedRegions: e.target.checked })}
          />
          {t("topbar.changesOnly")}
        </label>
        <label className="toggle" title={t("topbar.ignoreWsTitle")}>
          <input
            type="checkbox"
            checked={prefs.ignoreWhitespace}
            onChange={(e) => setPrefs({ ignoreWhitespace: e.target.checked })}
          />
          {t("topbar.ignoreWs")}
        </label>
        <label className="toggle" title={t("topbar.baseTitle")}>
          <input
            type="checkbox"
            checked={prefs.showBasePanel}
            onChange={(e) => setPrefs({ showBasePanel: e.target.checked })}
          />
          {t("topbar.base")}
        </label>
        <label className="toggle" title={t("topbar.listTitle")}>
          <input
            type="checkbox"
            checked={prefs.showConflictList}
            onChange={(e) => setPrefs({ showConflictList: e.target.checked })}
          />
          {t("topbar.list")}
        </label>{" "}
        <select
          className="theme-select"
          value={prefs.theme}
          aria-label={t("topbar.themeLabel")}
          onChange={(e) => setPrefs({ theme: e.target.value as ThemeName })}
        >
          {THEMES.map((th) => (
            <option key={th} value={th}>
              {t(`theme.${th}`)}
            </option>
          ))}
        </select>
        <button
          className="palette-button"
          onClick={() => setPaletteOpen(true)}
          title={`${t("topbar.commandPalette")}${paletteChord}`}
        >
          ⌘
        </button>
        <button
          className="settings-button"
          onClick={() => setSettingsOpen(true)}
          title={t("topbar.settings")}
          aria-label={t("topbar.settings")}
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
