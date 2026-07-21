import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../../stores/session";
import { DEFAULT_CUSTOM_THEME } from "../../types/session";
import type { CustomTheme, Language, ThemeName, WindowStartMode } from "../../types/session";
import { LANGUAGES } from "../../i18n";
import { COMMAND_META } from "../../features/commands";
import {
  chordFromEvent,
  effectiveKeybindings,
  formatChord,
  isDispatchableChord,
} from "../../features/keybindings";
import { Select } from "../common/Select";
import { Combobox } from "../common/Combobox";

type Tab = "appearance" | "font" | "language" | "shortcuts";

const TABS: Tab[] = ["appearance", "font", "language", "shortcuts"];
const THEMES: ThemeName[] = ["dark", "light", "system", "high-contrast", "custom"];
const WINDOW_MODES: WindowStartMode[] = ["default", "maximized", "fullscreen"];
const COLOR_TOKENS: (keyof CustomTheme)[] = [
  "bg",
  "bgElevated",
  "bgPanelHeader",
  "border",
  "text",
  "textDim",
  "accent",
  "danger",
  "ok",
  "warn",
  "conflict",
  "independent",
  "resolved",
  "reviewed",
  "diffInserted",
  "diffRemoved",
  "editorBg",
];
const COMMON_FONTS = [
  "Segoe UI",
  "system-ui",
  "Cascadia Code",
  "Consolas",
  "JetBrains Mono",
  "Fira Code",
  "Courier New",
  "Arial",
  "Georgia",
];

export function SettingsPanel() {
  const { t } = useTranslation();
  const open = useSession((s) => s.settingsOpen);
  const setOpen = useSession((s) => s.setSettingsOpen);
  const prefs = useSession((s) => s.prefs);
  const setPrefs = useSession((s) => s.setPrefs);
  const [tab, setTab] = useState<Tab>("appearance");
  const [capturing, setCapturing] = useState<string | null>(null);
  // Editable rows for the per-extension tab-width overrides. Kept as strings so
  // partially-typed values don't fight the number inputs; committed to prefs
  // (dropping blank/invalid rows) on every edit.
  const [tabRows, setTabRows] = useState<{ id: number; ext: string; size: string }[]>(() =>
    Object.entries(prefs.tabSizeOverrides).map(([ext, size], i) => ({
      id: i,
      ext,
      size: String(size),
    })),
  );
  const nextRowId = useRef(tabRows.length);

  if (!open) return null;

  const setColor = (token: keyof CustomTheme, value: string) =>
    setPrefs({ customTheme: { ...prefs.customTheme, [token]: value } });

  const bindings = effectiveKeybindings(prefs.keybindings);
  const chordOwners = (chord: string): string[] =>
    COMMAND_META.filter((m) => bindings[m.id] === chord).map((m) => m.id);

  const setKb = (id: string, chord: string) => {
    setPrefs({ keybindings: { ...prefs.keybindings, [id]: chord } });
    setCapturing(null);
  };
  const resetKb = (id: string) => {
    const next = { ...prefs.keybindings };
    delete next[id];
    setPrefs({ keybindings: next });
    setCapturing(null);
  };

  const commitTabRows = (rows: typeof tabRows) => {
    const map: Record<string, number> = {};
    for (const row of rows) {
      const ext = row.ext.trim().replace(/^\.+/, "").toLowerCase();
      const size = Number.parseInt(row.size, 10);
      if (ext && Number.isFinite(size) && size > 0) map[ext] = Math.min(16, size);
    }
    setPrefs({ tabSizeOverrides: map });
  };
  const updateTabRow = (id: number, patch: Partial<{ ext: string; size: string }>) => {
    const rows = tabRows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    setTabRows(rows);
    commitTabRows(rows);
  };
  const addTabRow = () => {
    setTabRows([...tabRows, { id: nextRowId.current++, ext: "", size: String(prefs.tabSize) }]);
  };
  const removeTabRow = (id: number) => {
    const rows = tabRows.filter((r) => r.id !== id);
    setTabRows(rows);
    commitTabRows(rows);
  };

  return (
    <div className="overlay" onMouseDown={() => setOpen(false)}>
      <div
        className="settings"
        role="dialog"
        aria-label={t("settings.title")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2>{t("settings.title")}</h2>
          <button className="btn-secondary" onClick={() => setOpen(false)}>
            {t("settings.close")}
          </button>
        </div>

        <div className="settings-tabs" role="tablist">
          {TABS.map((tabId) => (
            <button
              key={tabId}
              role="tab"
              aria-selected={tab === tabId}
              className={`settings-tab ${tab === tabId ? "active" : ""}`}
              onClick={() => setTab(tabId)}
            >
              {t(`settings.tab.${tabId}`)}
            </button>
          ))}
        </div>

        <div className="settings-body">
          {tab === "appearance" && (
            <>
              <div className="settings-row">
                <label htmlFor="theme-select">{t("settings.theme")}</label>
                <Select
                  id="theme-select"
                  value={prefs.theme}
                  options={THEMES.map((th) => ({ value: th, label: t(`theme.${th}`) }))}
                  onChange={(value) => setPrefs({ theme: value as ThemeName })}
                />
              </div>

              {prefs.theme === "custom" && (
                <>
                  <div className="settings-subhead">
                    <span>{t("settings.customColors")}</span>
                    <button
                      className="btn-secondary"
                      onClick={() => setPrefs({ customTheme: DEFAULT_CUSTOM_THEME })}
                    >
                      {t("settings.restoreDefaults")}
                    </button>
                  </div>
                  <div className="color-grid">
                    {COLOR_TOKENS.map((token) => (
                      <div className="color-row" key={token}>
                        <input
                          type="color"
                          aria-label={t(`settings.color.${token}`)}
                          value={prefs.customTheme[token]}
                          onChange={(e) => setColor(token, e.target.value)}
                        />
                        <label>{t(`settings.color.${token}`)}</label>
                        <input
                          type="text"
                          value={prefs.customTheme[token]}
                          spellCheck={false}
                          onChange={(e) => setColor(token, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="settings-subhead">
                <span>{t("settings.editor")}</span>
              </div>
              <label className="settings-row settings-check">
                <input
                  type="checkbox"
                  checked={prefs.showResultMinimap}
                  onChange={(e) => setPrefs({ showResultMinimap: e.target.checked })}
                />
                <span>{t("settings.resultMinimap")}</span>
              </label>
              <label className="settings-row settings-check">
                <input
                  type="checkbox"
                  checked={prefs.renderWhitespace}
                  onChange={(e) => setPrefs({ renderWhitespace: e.target.checked })}
                />
                <span>{t("settings.renderWhitespace")}</span>
              </label>

              <div className="settings-row">
                <label htmlFor="tab-size">{t("settings.tabSize")}</label>
                <input
                  id="tab-size"
                  type="number"
                  min={1}
                  max={16}
                  value={prefs.tabSize}
                  onChange={(e) => setPrefs({ tabSize: clampTabSize(e.target.value, 4) })}
                />
              </div>
              <div className="settings-subhead">
                <span>{t("settings.tabSizeOverrides")}</span>
                <button className="btn-secondary" onClick={addTabRow}>
                  {t("settings.tabSizeAdd")}
                </button>
              </div>
              <p className="settings-hint">{t("settings.tabSizeHint")}</p>
              <div className="tab-override-list">
                {tabRows.map((row) => (
                  <div className="tab-override-row" key={row.id}>
                    <input
                      type="text"
                      className="tab-override-ext"
                      spellCheck={false}
                      placeholder={t("settings.tabSizeExtPlaceholder")}
                      aria-label={t("settings.tabSizeExtAria")}
                      value={row.ext}
                      onChange={(e) => updateTabRow(row.id, { ext: e.target.value })}
                    />
                    <input
                      type="number"
                      className="tab-override-size"
                      min={1}
                      max={16}
                      aria-label={t("settings.tabSizeValueAria")}
                      value={row.size}
                      onChange={(e) => updateTabRow(row.id, { size: e.target.value })}
                    />
                    <button
                      className="btn-secondary"
                      title={t("settings.tabSizeRemove")}
                      aria-label={t("settings.tabSizeRemove")}
                      onClick={() => removeTabRow(row.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="settings-subhead">
                <span>{t("settings.window")}</span>
              </div>
              <div className="settings-row">
                <label htmlFor="window-mode-select">{t("settings.windowMode")}</label>
                <Select
                  id="window-mode-select"
                  value={prefs.windowStartMode}
                  options={WINDOW_MODES.map((mode) => ({
                    value: mode,
                    label: t(`settings.windowModeOption.${mode}`),
                  }))}
                  onChange={(value) => setPrefs({ windowStartMode: value as WindowStartMode })}
                />
              </div>
              <p className="settings-hint">{t(`settings.windowModeHint.${prefs.windowStartMode}`)}</p>
            </>
          )}

          {tab === "font" && (
            <>
              <div className="settings-row">
                <label htmlFor="ui-font">{t("settings.font.uiFamily")}</label>
                <Combobox
                  id="ui-font"
                  options={COMMON_FONTS}
                  placeholder={t("settings.font.familyPlaceholder")}
                  value={prefs.uiFontFamily}
                  onChange={(value) => setPrefs({ uiFontFamily: value })}
                />
              </div>
              <div className="settings-row">
                <label htmlFor="ui-size">{t("settings.font.uiSize")}</label>
                <input
                  id="ui-size"
                  type="number"
                  min={9}
                  max={28}
                  value={prefs.uiFontSize}
                  onChange={(e) => setPrefs({ uiFontSize: clampSize(e.target.value, 13) })}
                />
              </div>
              <div className="settings-row">
                <label htmlFor="editor-font">{t("settings.font.editorFamily")}</label>
                <Combobox
                  id="editor-font"
                  options={COMMON_FONTS}
                  placeholder={t("settings.font.familyPlaceholder")}
                  value={prefs.editorFontFamily}
                  onChange={(value) => setPrefs({ editorFontFamily: value })}
                />
              </div>
              <div className="settings-row">
                <label htmlFor="editor-size">{t("settings.font.editorSize")}</label>
                <input
                  id="editor-size"
                  type="number"
                  min={9}
                  max={28}
                  value={prefs.editorFontSize}
                  onChange={(e) => setPrefs({ editorFontSize: clampSize(e.target.value, 13) })}
                />
              </div>
            </>
          )}

          {tab === "language" && (
            <div className="settings-row">
              <label htmlFor="lang-select">{t("settings.language")}</label>
              <Select
                id="lang-select"
                value={prefs.language}
                options={LANGUAGES.map((lng) => ({ value: lng, label: t(`language.${lng}`) }))}
                onChange={(value) => setPrefs({ language: value as Language })}
              />
            </div>
          )}

          {tab === "shortcuts" && (
            <>
              <div className="settings-subhead">
                <span>{t("settings.shortcuts.press")}</span>
                <button className="btn-secondary" onClick={() => setPrefs({ keybindings: {} })}>
                  {t("settings.shortcuts.resetAll")}
                </button>
              </div>
              <div className="shortcut-list">
                {COMMAND_META.map((m) => {
                  const chord = bindings[m.id];
                  const owners = chord ? chordOwners(chord).filter((id) => id !== m.id) : [];
                  return (
                    <div className="shortcut-row" key={m.id}>
                      <span className="shortcut-title">{t(m.titleKey)}</span>
                      {owners.length > 0 && (
                        <span className="shortcut-conflict">
                          {t("settings.shortcuts.conflictWith", {
                            command: t(`command.${owners[0]}`),
                          })}
                        </span>
                      )}
                      <button
                        className={`shortcut-key ${capturing === m.id ? "capturing" : ""} ${
                          !chord ? "unassigned" : ""
                        }`}
                        onClick={() => setCapturing(m.id)}
                        onBlur={() => capturing === m.id && setCapturing(null)}
                        onKeyDown={(e) => {
                          if (capturing !== m.id) return;
                          e.preventDefault();
                          e.stopPropagation();
                          if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
                          if (e.key === "Escape") return setCapturing(null);
                          if (e.key === "Backspace" || e.key === "Delete") return setKb(m.id, "");
                          const next = chordFromEvent(e.nativeEvent);
                          if (next && isDispatchableChord(next)) setKb(m.id, next);
                        }}
                      >
                        {capturing === m.id
                          ? t("settings.shortcuts.press")
                          : chord
                            ? formatChord(chord)
                            : t("settings.shortcuts.none")}
                      </button>
                      <button
                        className="btn-secondary"
                        title={t("settings.shortcuts.reset")}
                        onClick={() => resetKb(m.id)}
                      >
                        ↺
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function clampSize(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(28, Math.max(9, n));
}

function clampTabSize(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(16, Math.max(1, n));
}
