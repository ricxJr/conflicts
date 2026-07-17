import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { monaco, detectLanguage } from "../../editor/monaco";
import { useSession } from "../../stores/session";

/**
 * Isolated, full-width side-by-side view of one side's diff against BASE — the
 * exact same comparison the diff panel shows, pulled out for a focused read.
 * Opened by clicking a side's commit in the diff header.
 *
 * It reads the session content already in memory (original = BASE, modified =
 * the side) instead of asking git for the commit-vs-parent diff. That kept the
 * two views out of sync — a merge commit's diff against its own parent barely
 * touches the file, so the old viewer looked empty next to the panel. Reusing
 * the session inputs means it always matches the panel and works for merge
 * commits, single-file launches, and never-pushed commits alike.
 */
export function CommitDiffModal() {
  const { t } = useTranslation();
  const target = useSession((s) => s.commitDiff);
  const close = useSession((s) => s.closeCommitDiff);
  const files = useSession((s) => s.session?.files);
  const editorFontFamily = useSession((s) => s.prefs.editorFontFamily);
  const editorFontSize = useSession((s) => s.prefs.editorFontSize);
  const ignoreWhitespace = useSession((s) => s.prefs.ignoreWhitespace);
  const hideUnchanged = useSession((s) => s.prefs.hideUnchangedRegions);
  const containerRef = useRef<HTMLDivElement>(null);

  const baseContent = files?.base?.content ?? "";
  const sideContent =
    target?.side === "left" ? (files?.current.content ?? "") : (files?.incoming.content ?? "");
  const fileName = files?.result.fileName ?? "";

  // Close on Escape while open.
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, close]);

  // Build the Monaco diff editor: original = BASE, modified = this side. Same
  // whitespace/collapse preferences as the panel so the highlighting matches;
  // always side-by-side, since a roomy comparison is the point of isolating it.
  useEffect(() => {
    if (!target || !containerRef.current) return;
    const language = detectLanguage(fileName);
    const original = monaco.editor.createModel(baseContent, language);
    const modified = monaco.editor.createModel(sideContent, language);
    const editor = monaco.editor.createDiffEditor(containerRef.current, {
      readOnly: true,
      originalEditable: false,
      renderSideBySide: true,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: editorFontSize,
      fontFamily: editorFontFamily || undefined,
      ignoreTrimWhitespace: ignoreWhitespace,
      hideUnchangedRegions: { enabled: hideUnchanged },
    });
    editor.setModel({ original, modified });
    return () => {
      editor.dispose();
      original.dispose();
      modified.dispose();
    };
  }, [
    target,
    baseContent,
    sideContent,
    fileName,
    editorFontFamily,
    editorFontSize,
    ignoreWhitespace,
    hideUnchanged,
  ]);

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
        <div ref={containerRef} className="commit-diff-editor" />
      </div>
    </div>
  );
}
