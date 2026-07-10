import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { monaco, detectLanguage } from "../../editor/monaco";
import { useSession } from "../../stores/session";

interface BaseViewerProps {
  content: string;
  fileName: string;
  filePath: string;
}

/** Read-only viewer for the common ancestor (RF-007, pinned as a panel). */
export function BaseViewer({ content, fileName, filePath }: BaseViewerProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const editorFontFamily = useSession((s) => s.prefs.editorFontFamily);
  const editorFontSize = useSession((s) => s.prefs.editorFontSize);

  useEffect(() => {
    if (!containerRef.current) return;
    const model = monaco.editor.createModel(content, detectLanguage(fileName));
    const editor = monaco.editor.create(containerRef.current, {
      model,
      readOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: editorFontSize,
      fontFamily: editorFontFamily || undefined,
      lineNumbersMinChars: 3,
    });
    editorRef.current = editor;
    return () => {
      editor.dispose();
      model.dispose();
    };
  }, [content, fileName]);

  useEffect(() => {
    editorRef.current?.updateOptions({
      fontSize: editorFontSize,
      fontFamily: editorFontFamily || undefined,
    });
  }, [editorFontSize, editorFontFamily]);

  return (
    <section className="panel base-panel" aria-label={t("panel.baseAria")}>
      <header className="panel-header">
        <span className="panel-title">BASE</span>
        <span className="panel-path" title={filePath}>
          {filePath}
        </span>
      </header>
      <div ref={containerRef} className="editor-host" />
    </section>
  );
}
