import { useEffect, useRef } from "react";
import { monaco, detectLanguage } from "../../editor/monaco";

interface BaseViewerProps {
  content: string;
  fileName: string;
  filePath: string;
}

/** Read-only viewer for the common ancestor (RF-007, pinned as a panel). */
export function BaseViewer({ content, fileName, filePath }: BaseViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const model = monaco.editor.createModel(content, detectLanguage(fileName));
    const editor = monaco.editor.create(containerRef.current, {
      model,
      readOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      lineNumbersMinChars: 3,
    });
    return () => {
      editor.dispose();
      model.dispose();
    };
  }, [content, fileName]);

  return (
    <section className="panel base-panel" aria-label="Base (common ancestor)">
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
