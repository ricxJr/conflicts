import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { monaco, detectLanguage } from "../../editor/monaco";
import { useSession } from "../../stores/session";
import { commitFileDiff } from "../../services/backend";
import type { CommitDiffOutput } from "../../types/session";

/**
 * In-app viewer for a single commit's diff on the session's file (the commit
 * against its parent). Opened by clicking a side's commit in the diff header —
 * replaces the old external web link, which 404'd for unpushed commits.
 */
export function CommitDiffModal() {
  const { t } = useTranslation();
  const target = useSession((s) => s.commitDiff);
  const close = useSession((s) => s.closeCommitDiff);
  const editorFontFamily = useSession((s) => s.prefs.editorFontFamily);
  const editorFontSize = useSession((s) => s.prefs.editorFontSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<CommitDiffOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sha = target?.commit.sha;

  // Fetch the diff whenever a new commit is targeted.
  useEffect(() => {
    if (!sha) return;
    let cancelled = false;
    setData(null);
    setError(null);
    setLoading(true);
    commitFileDiff(sha)
      .then((d) => !cancelled && setData(d))
      .catch(
        (e) => !cancelled && setError(typeof e === "string" ? e : (e?.message ?? String(e))),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sha]);

  // Close on Escape while open.
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, close]);

  // Build the Monaco diff editor once the content is available.
  useEffect(() => {
    if (!data || !containerRef.current) return;
    const language = detectLanguage(data.fileName);
    const original = monaco.editor.createModel(data.before, language);
    const modified = monaco.editor.createModel(data.after, language);
    const editor = monaco.editor.createDiffEditor(containerRef.current, {
      readOnly: true,
      originalEditable: false,
      renderSideBySide: true,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: editorFontSize,
      fontFamily: editorFontFamily || undefined,
    });
    editor.setModel({ original, modified });
    return () => {
      editor.dispose();
      original.dispose();
      modified.dispose();
    };
  }, [data, editorFontFamily, editorFontSize]);

  if (!target) return null;
  const { commit, side } = target;
  const roleKey = side === "left" ? "panel.sideCurrent" : "panel.sideIncoming";

  return (
    <div className="overlay" onMouseDown={close}>
      <div
        className="commit-diff"
        role="dialog"
        aria-label={t("commitDiff.title", { sha: commit.shortSha })}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="commit-diff-header">
          <div className="commit-diff-meta">
            <span className={`badge badge-side badge-side-${side}`}>{t(roleKey)}</span>
            <span className="commit-sha">{commit.shortSha}</span>
            <span className="commit-diff-subject" title={commit.subject}>
              {commit.subject}
            </span>
            <span className="commit-author">
              {t("panel.commit.authoredBy", { author: commit.author })}
            </span>
          </div>
          <button className="btn-secondary" onClick={close}>
            {t("settings.close")}
          </button>
        </div>
        {loading && <div className="commit-diff-status">{t("commitDiff.loading")}</div>}
        {error && (
          <div className="commit-diff-status commit-diff-error" role="alert">
            {t("commitDiff.error", { message: error })}
          </div>
        )}
        <div ref={containerRef} className="commit-diff-editor" hidden={!data} />
      </div>
    </div>
  );
}
