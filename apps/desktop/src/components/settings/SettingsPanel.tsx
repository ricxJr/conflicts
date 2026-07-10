import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../../stores/session";
import { DEFAULT_CUSTOM_THEME } from "../../types/session";
import type { CustomTheme, Language, ThemeName } from "../../types/session";
import { LANGUAGES } from "../../i18n";
import { COMMAND_META } from "../../features/commands";
import {
  chordFromEvent,
  effectiveKeybindings,
  formatChord,
  isDispatchableChord,
} from "../../features/keybindings";

type Tab = "appearance" | "font" | "language" | "shortcuts";

const TABS: Tab[] = ["appearance", "font", "language", "shortcuts"];
const THEMES: ThemeName[] = ["dark", "light", "system", "high-contrast", "custom"];
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
                <select
                  id="theme-select"
                  value={prefs.theme}
                  onChange={(e) => setPrefs({ theme: e.target.value as ThemeName })}
                >
                  {THEMES.map((th) => (
                    <option key={th} value={th}>
                      {t(`theme.${th}`)}
                    </option>
                  ))}
                </select>
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
            </>
          )}

          {tab === "font" && (
            <>
              <datalist id="font-suggestions">
                {COMMON_FONTS.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
              <div className="settings-row">
                <label htmlFor="ui-font">{t("settings.font.uiFamily")}</label>
                <input
                  id="ui-font"
                  type="text"
                  list="font-suggestions"
                  placeholder={t("settings.font.familyPlaceholder")}
                  value={prefs.uiFontFamily}
                  onChange={(e) => setPrefs({ uiFontFamily: e.target.value })}
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
                <input
                  id="editor-font"
                  type="text"
                  list="font-suggestions"
                  placeholder={t("settings.font.familyPlaceholder")}
                  value={prefs.editorFontFamily}
                  onChange={(e) => setPrefs({ editorFontFamily: e.target.value })}
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
              <select
                id="lang-select"
                value={prefs.language}
                onChange={(e) => setPrefs({ language: e.target.value as Language })}
              >
                {LANGUAGES.map((lng) => (
                  <option key={lng} value={lng}>
                    {t(`language.${lng}`)}
                  </option>
                ))}
              </select>
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
