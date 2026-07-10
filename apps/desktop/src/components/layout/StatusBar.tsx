import { useTranslation } from "react-i18next";
import { useSession } from "../../stores/session";
import { effectiveKeybindings, formatChord } from "../../features/keybindings";

export function StatusBar() {
  const { t } = useTranslation();
  const session = useSession((s) => s.session);
  const unresolved = useSession((s) => s.unresolvedCount);
  const dirty = useSession((s) => s.dirty);
  const cursor = useSession((s) => s.cursor);
  const prefs = useSession((s) => s.prefs);
  const save = useSession((s) => s.save);
  const cancel = useSession((s) => s.cancel);
  const readonly = session?.cli.readonly ?? false;

  const result = session?.files.result;
  const encodingLabel = result?.encoding === "utf-8-bom" ? "UTF-8 BOM" : "UTF-8";
  const eolLabel = result?.eol === "crlf" ? "CRLF" : result?.eol === "mixed" ? "MIXED EOL" : "LF";

  const kb = effectiveKeybindings(prefs.keybindings);
  const withKey = (label: string, id: string) =>
    kb[id] ? `${label} (${formatChord(kb[id])})` : label;

  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <span className={unresolved > 0 ? "status-unresolved" : "status-ok"}>
          {unresolved > 0 ? t("status.unresolved", { count: unresolved }) : t("status.allResolved")}
        </span>
        {result?.eol === "mixed" && (
          <span className="status-warning" title={t("status.mixedEolTitle")}>
            {t("status.mixedEol")}
          </span>
        )}
        {result?.hadDecodeErrors && (
          <span className="status-warning" title={t("status.decodeTitle")}>
            {t("status.decode")}
          </span>
        )}
        {dirty && <span className="status-dirty">{t("status.unsaved")}</span>}
      </div>
      <div className="statusbar-right">
        <span>{encodingLabel}</span>
        <span>{eolLabel}</span>
        <span>{t("status.lineCol", { line: cursor.line, column: cursor.column })}</span>
        <button
          className="btn-secondary"
          onClick={cancel}
          title={withKey(t("tooltip.cancel"), "cancel")}
        >
          {t("action.cancel")}
        </button>
        <button
          className="btn-secondary"
          disabled={readonly}
          onClick={() => void save(false)}
          title={withKey(t("tooltip.save"), "save")}
        >
          {t("action.save")}
        </button>
        <button
          className="btn-primary"
          disabled={readonly}
          onClick={() => void save(true)}
          title={t("tooltip.saveClose")}
        >
          {t("action.saveClose")}
        </button>
      </div>
    </footer>
  );
}
