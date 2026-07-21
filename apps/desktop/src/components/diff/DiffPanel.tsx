import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { monaco, detectLanguage, lineNumberGutterChars, resolveTabSize } from "../../editor/monaco";
import { editors } from "../../stores/controllers";
import { useSession } from "../../stores/session";
import { modifiedLineToBase } from "../../features/diffGeometry";
import type { CommitInfo } from "../../types/session";

interface DiffPanelProps {
  side: "left" | "right";
  /** Branch/label of this side, shown compared against BASE in the header. */
  branchLabel: string;
  /** Small badge naming the side's role (Current/Incoming). */
  roleLabel: string;
  baseContent: string;
  sideContent: string;
  fileName: string;
  filePath: string;
  /** Commit backing this side, when git could resolve it. */
  commit?: CommitInfo;
}

/** Ignore clicks on scrollbars/rulers; anything with a position is fair game. */
function isNavigableTarget(target: monaco.editor.IMouseTarget): boolean {
  return (
    target.type !== monaco.editor.MouseTargetType.SCROLLBAR &&
    target.type !== monaco.editor.MouseTargetType.OVERVIEW_RULER
  );
}

/** Read-only Monaco diff editor: original = BASE, modified = CURRENT/INCOMING. */
export function DiffPanel({
  side,
  branchLabel,
  roleLabel,
  baseContent,
  sideContent,
  fileName,
  filePath,
  commit,
}: DiffPanelProps) {
  const { t } = useTranslation();
  const openCommitDiff = useSession((s) => s.openCommitDiff);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const hideUnchanged = useSession((s) => s.prefs.hideUnchangedRegions);
  const ignoreWhitespace = useSession((s) => s.prefs.ignoreWhitespace);
  const showConflictList = useSession((s) => s.prefs.showConflictList);
  const editorFontFamily = useSession((s) => s.prefs.editorFontFamily);
  const editorFontSize = useSession((s) => s.prefs.editorFontSize);
  const renderWhitespace = useSession((s) => s.prefs.renderWhitespace);
  const tabSize = useSession((s) => s.prefs.tabSize);
  const tabSizeOverrides = useSession((s) => s.prefs.tabSizeOverrides);

  useEffect(() => {
    if (!containerRef.current) return;
    const language = detectLanguage(fileName);
    const original = monaco.editor.createModel(baseContent, language);
    const modified = monaco.editor.createModel(sideContent, language);
    const resolvedTabSize = resolveTabSize(fileName, { tabSize, tabSizeOverrides });
    original.updateOptions({ tabSize: resolvedTabSize });
    modified.updateOptions({ tabSize: resolvedTabSize });

    const editor = monaco.editor.createDiffEditor(containerRef.current, {
      readOnly: true,
      originalEditable: false,
      renderSideBySide: !showConflictList,
      useInlineViewWhenSpaceIsLimited: false,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderOverviewRuler: true,
      diffWordWrap: "off",
      renderWhitespace: renderWhitespace ? "all" : "none",
      fontSize: editorFontSize,
      fontFamily: editorFontFamily || undefined,
      lineNumbersMinChars: lineNumberGutterChars(
        Math.max(original.getLineCount(), modified.getLineCount()),
      ),
      ignoreTrimWhitespace: ignoreWhitespace,
      hideUnchangedRegions: { enabled: hideUnchanged },
    });
    editor.setModel({ original, modified });
    editorRef.current = editor;
    editors[side] = editor;

    // Clicking a change focuses its conflict group: the toolbar/shortcut
    // resolution then targets exactly what was clicked (base-line mapped).
    const activate = (baseLine1: number) => {
      useSession.getState().activateGroupAtBaseLine(baseLine1 - 1, { revealPanels: false });
    };
    const clickSubs = [
      editor.getOriginalEditor().onMouseDown((e) => {
        if (!e.target.position || !isNavigableTarget(e.target)) return;
        activate(e.target.position.lineNumber);
      }),
      editor.getModifiedEditor().onMouseDown((e) => {
        if (!e.target.position || !isNavigableTarget(e.target)) return;
        const changes = editor.getLineChanges();
        if (changes) activate(modifiedLineToBase(changes, e.target.position.lineNumber));
      }),
    ];

    return () => {
      clickSubs.forEach((s) => s.dispose());
      if (editors[side] === editor) delete editors[side];
      editor.dispose();
      original.dispose();
      modified.dispose();
    };
    // Models are created once per session content.
  }, [baseContent, sideContent, fileName, side]);

  useEffect(() => {
    editorRef.current?.updateOptions({
      ignoreTrimWhitespace: ignoreWhitespace,
      renderSideBySide: !showConflictList,
      useInlineViewWhenSpaceIsLimited: false,
      hideUnchangedRegions: { enabled: hideUnchanged },
      renderWhitespace: renderWhitespace ? "all" : "none",
      fontSize: editorFontSize,
      fontFamily: editorFontFamily || undefined,
    });
    const models = editorRef.current?.getModel();
    if (models) {
      const resolvedTabSize = resolveTabSize(fileName, { tabSize, tabSizeOverrides });
      models.original.updateOptions({ tabSize: resolvedTabSize });
      models.modified.updateOptions({ tabSize: resolvedTabSize });
    }
  }, [
    hideUnchanged,
    ignoreWhitespace,
    showConflictList,
    editorFontSize,
    editorFontFamily,
    renderWhitespace,
    tabSize,
    tabSizeOverrides,
    fileName,
  ]);

  const commitBody = commit && (
    <>
      <span className="commit-sha">{commit.shortSha}</span>
      <span className="commit-author">
        {t("panel.commit.authoredBy", { author: commit.author })}
      </span>
    </>
  );
  const commitTooltip = commit
    ? t("panel.commit.tooltip", { sha: commit.sha, subject: commit.subject })
    : undefined;

  const compareAria = t("panel.comparedToBase", { role: roleLabel, label: branchLabel });

  return (
    <section className="panel diff-panel" aria-label={compareAria}>
      <header className="panel-header">
        <div className="panel-header-main">
          <span className={`badge badge-side badge-side-${side}`}>{roleLabel}</span>
          <span className="panel-compare" title={compareAria}>
            <span className={`compare-branch compare-branch-${side}`}>{branchLabel}</span>
            <span className="compare-vs" aria-hidden>
              ⟷
            </span>
            <span className="compare-base">{t("panel.baseLabel")}</span>
          </span>
          {commit && (
            <button
              type="button"
              className="commit-link"
              onClick={() => openCommitDiff(commit, side)}
              title={commitTooltip}
              aria-label={t("panel.commit.openCommit", { sha: commit.shortSha })}
            >
              {commitBody}
            </button>
          )}
        </div>
        <span className="panel-path" title={filePath}>
          {filePath}
        </span>
      </header>
      <div ref={containerRef} className="editor-host" />
    </section>
  );
}
