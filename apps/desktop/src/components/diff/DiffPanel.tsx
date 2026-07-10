import { useEffect, useRef } from "react";
import { monaco, detectLanguage } from "../../editor/monaco";
import { editors } from "../../stores/controllers";
import { useSession } from "../../stores/session";

interface DiffPanelProps {
  side: "left" | "right";
  title: string;
  baseContent: string;
  sideContent: string;
  fileName: string;
  filePath: string;
}

/** Read-only Monaco diff editor: original = BASE, modified = CURRENT/INCOMING. */
export function DiffPanel({
  side,
  title,
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
      lineNumbersMinChars: 3,
      ignoreTrimWhitespace: ignoreWhitespace,
      hideUnchangedRegions: { enabled: hideUnchanged },
    });
    editor.setModel({ original, modified });
    editorRef.current = editor;
    editors[side] = editor;

    return () => {
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
        <span className="panel-title">{title}</span>
        <span className="panel-path" title={filePath}>
          {filePath}
        </span>
      </header>
      <div ref={containerRef} className="editor-host" />
    </section>
  );
}
