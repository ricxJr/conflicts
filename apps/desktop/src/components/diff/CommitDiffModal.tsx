import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { monaco, detectLanguage, applyTabWidth } from "../../editor/monaco";
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
  const renderWhitespace = useSession((s) => s.prefs.renderWhitespace);
  const tabSize = useSession((s) => s.prefs.tabSize);
  const tabSizeOverrides = useSession((s) => s.prefs.tabSizeOverrides);
  const width = useSession((s) => s.prefs.commitDiffWidth);
  const height = useSession((s) => s.prefs.commitDiffHeight);
  const containerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

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
    applyTabWidth(original, fileName, { tabSize, tabSizeOverrides });
    applyTabWidth(modified, fileName, { tabSize, tabSizeOverrides });
    const editor = monaco.editor.createDiffEditor(containerRef.current, {
      readOnly: true,
      originalEditable: false,
      renderSideBySide: true,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderWhitespace: renderWhitespace ? "all" : "none",
      fontSize: editorFontSize,
      fontFamily: editorFontFamily || undefined,
      ignoreTrimWhitespace: ignoreWhitespace,
      hideUnchangedRegions: { enabled: hideUnchanged },
    });
    // Tab width is owned by applyTabWidth; keep Monaco from re-guessing it on
    // attach (setModel). detectIndentation isn't a diff-editor construction
    // option, so set it on the inner editors before wiring the models.
    editor.getOriginalEditor().updateOptions({ detectIndentation: false });
    editor.getModifiedEditor().updateOptions({ detectIndentation: false });
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
    renderWhitespace,
    tabSize,
    tabSizeOverrides,
  ]);

  // Persist the user's chosen size (drag-resize via CSS `resize: both`) so the
  // viewer reopens at the size they left it. Debounced to avoid a write per
  // pixel; border-box means offsetWidth/Height match the CSS size exactly.
  useEffect(() => {
    const el = dialogRef.current;
    if (!target || !el) return;
    let timer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const prefs = useSession.getState().prefs;
        if (w > 0 && h > 0 && (w !== prefs.commitDiffWidth || h !== prefs.commitDiffHeight)) {
          useSession.getState().setPrefs({ commitDiffWidth: w, commitDiffHeight: h });
        }
      }, 300);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [target]);

  if (!target) return null;
  const { commit, side } = target;
  const roleKey = side === "left" ? "panel.sideCurrent" : "panel.sideIncoming";

  return (
    <div className="overlay" onMouseDown={close}>
      <div
        ref={dialogRef}
        className="commit-diff"
        role="dialog"
        aria-label={t("commitDiff.title", { sha: commit.shortSha })}
        style={{ width, height }}
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
