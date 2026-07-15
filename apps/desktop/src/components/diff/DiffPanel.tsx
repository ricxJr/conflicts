import { useEffect, useRef } from "react";
import { monaco, detectLanguage, lineNumberGutterChars } from "../../editor/monaco";
import { editors } from "../../stores/controllers";
import { useSession } from "../../stores/session";
import { modifiedLineToBase } from "../../features/diffGeometry";

interface DiffPanelProps {
  side: "left" | "right";
  title: string;
  /** Small badge naming the side's role (Current/Incoming). */
  roleLabel: string;
  baseContent: string;
  sideContent: string;
  fileName: string;
  filePath: string;
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
  title,
  roleLabel,
  baseContent,
  sideContent,
  fileName,
  filePath,
}: DiffPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const hideUnchanged = useSession((s) => s.prefs.hideUnchangedRegions);
  const ignoreWhitespace = useSession((s) => s.prefs.ignoreWhitespace);
  const showConflictList = useSession((s) => s.prefs.showConflictList);
  const editorFontFamily = useSession((s) => s.prefs.editorFontFamily);
  const editorFontSize = useSession((s) => s.prefs.editorFontSize);

  useEffect(() => {
    if (!containerRef.current) return;
    const language = detectLanguage(fileName);
    const original = monaco.editor.createModel(baseContent, language);
    const modified = monaco.editor.createModel(sideContent, language);

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
      useSession
        .getState()
        .activateGroupAtBaseLine(baseLine1 - 1, { revealPanels: false });
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
      fontSize: editorFontSize,
      fontFamily: editorFontFamily || undefined,
    });
  }, [hideUnchanged, ignoreWhitespace, showConflictList, editorFontSize, editorFontFamily]);

  return (
    <section className="panel diff-panel" aria-label={title}>
      <header className="panel-header">
        <span className="panel-title panel-branch" title={title}>
          {title}
        </span>
        <span className={`badge badge-side badge-side-${side}`}>{roleLabel}</span>
        <span className="panel-path" title={filePath}>
          {filePath}
        </span>
      </header>
      <div ref={containerRef} className="editor-host" />
    </section>
  );
}
