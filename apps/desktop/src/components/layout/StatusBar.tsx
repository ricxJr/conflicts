import { useSession } from "../../stores/session";

export function StatusBar() {
  const session = useSession((s) => s.session);
  const unresolved = useSession((s) => s.unresolvedCount);
  const dirty = useSession((s) => s.dirty);
  const cursor = useSession((s) => s.cursor);
  const save = useSession((s) => s.save);
  const cancel = useSession((s) => s.cancel);
  const readonly = session?.cli.readonly ?? false;

  const result = session?.files.result;
  const encodingLabel = result?.encoding === "utf-8-bom" ? "UTF-8 BOM" : "UTF-8";
  const eolLabel = result?.eol === "crlf" ? "CRLF" : result?.eol === "mixed" ? "MIXED EOL" : "LF";

  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <span className={unresolved > 0 ? "status-unresolved" : "status-ok"}>
          {unresolved > 0 ? `${unresolved} unresolved` : "All conflicts resolved"}
        </span>
        {result?.eol === "mixed" && (
          <span className="status-warning" title="The file mixes CRLF and LF line endings">
            ⚠ mixed EOL
          </span>
        )}
        {result?.hadDecodeErrors && (
          <span className="status-warning" title="Some bytes could not be decoded as UTF-8">
            ⚠ decode
          </span>
        )}
        {dirty && <span className="status-dirty">● unsaved</span>}
      </div>
      <div className="statusbar-right">
        <span>{encodingLabel}</span>
        <span>{eolLabel}</span>
        <span>
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <button className="btn-secondary" onClick={cancel} title="Cancel (Esc) — exit code 1">
          Cancel
        </button>
        <button
          className="btn-secondary"
          disabled={readonly}
          onClick={() => void save(false)}
          title="Save (Ctrl+S)"
        >
          Save
        </button>
        <button
          className="btn-primary"
          disabled={readonly}
          onClick={() => void save(true)}
          title="Save and close — exit code 0"
        >
          Save &amp; Close
        </button>
      </div>
    </footer>
  );
}
