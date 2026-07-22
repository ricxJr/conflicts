import { useEffect, useRef } from "react";
import { monaco, detectLanguage, lineNumberGutterChars, applyTabWidth } from "../../editor/monaco";
import { editors, type ResultController } from "../../stores/controllers";
import { useSession } from "../../stores/session";
import { ResolutionToolbar } from "./ResolutionToolbar";

interface RegionInfo {
  decorationId: string;
  /** When collapsed, the region is an insertion point before this 1-based line. */
  collapsedAtLine: number | null;
}

function regionClass(status: string, classification: string): string {
  if (status === "unresolved") return "msr-region msr-unresolved";
  if (status === "reviewed") return "msr-region msr-reviewed";
  if (classification === "independent") return "msr-region msr-independent";
  return "msr-region msr-resolved";
}

/** Editable merged-result editor with decoration-tracked conflict regions. */
export function ResultPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const regionsRef = useRef<Map<string, RegionInfo>>(new Map());
  const suppressRef = useRef(0);

  const initialResult = useSession((s) => s.initialResult);
  const session = useSession((s) => s.session);
  const groups = useSession((s) => s.groups);
  const editorFontFamily = useSession((s) => s.prefs.editorFontFamily);
  const editorFontSize = useSession((s) => s.prefs.editorFontSize);
  const showResultMinimap = useSession((s) => s.prefs.showResultMinimap);
  const renderWhitespace = useSession((s) => s.prefs.renderWhitespace);
  const tabSize = useSession((s) => s.prefs.tabSize);
  const tabSizeOverrides = useSession((s) => s.prefs.tabSizeOverrides);
  const readonly = session?.cli.readonly ?? false;

  // Create the editor once.
  useEffect(() => {
    if (!containerRef.current) return;
    const editor = monaco.editor.create(containerRef.current, {
      automaticLayout: true,
      // Tab width is owned by applyTabWidth; keep Monaco from re-guessing it.
      detectIndentation: false,
      minimap: { enabled: showResultMinimap },
      scrollBeyondLastLine: false,
      renderWhitespace: renderWhitespace ? "all" : "none",
      fontSize: editorFontSize,
      fontFamily: editorFontFamily || undefined,
      lineNumbersMinChars: 3,
      renderLineHighlight: "all",
      readOnly: readonly,
    });
    editorRef.current = editor;
    editors.resultEditor = editor;

    const cursorSub = editor.onDidChangeCursorPosition((e) => {
      useSession.getState().setCursor(e.position.lineNumber, e.position.column);
    });

    // Clicking inside a region makes it the active conflict (no scrolling —
    // the user is already exactly where they want to be).
    const clickSub = editor.onMouseDown((e) => {
      const line = e.target.position?.lineNumber;
      if (!line) return;
      const state = useSession.getState();
      for (const [groupId, info] of regionsRef.current) {
        if (info.collapsedAtLine !== null) continue;
        const span = controller.getRegionSpan(groupId);
        if (!span || line < span.startLine || line >= span.endLine) continue;
        const index = state.groups.findIndex((g) => g.id === groupId);
        if (index >= 0 && index !== state.activeIndex) {
          state.setActiveIndex(index, { revealPanels: true, revealResult: false });
        }
        break;
      }
    });

    return () => {
      cursorSub.dispose();
      clickSub.dispose();
      if (editors.resultEditor === editor) delete editors.resultEditor;
      editor.dispose();
    };
  }, []);

  // React to editor font preference changes.
  useEffect(() => {
    editorRef.current?.updateOptions({
      fontSize: editorFontSize,
      fontFamily: editorFontFamily || undefined,
    });
  }, [editorFontSize, editorFontFamily]);

  // React to minimap / whitespace-rendering preference changes.
  useEffect(() => {
    editorRef.current?.updateOptions({
      minimap: { enabled: showResultMinimap },
      renderWhitespace: renderWhitespace ? "all" : "none",
    });
  }, [showResultMinimap, renderWhitespace]);

  // React to tab-width preference changes (file name is stable per session).
  useEffect(() => {
    const fileName = session?.files.result.fileName;
    if (!fileName) return;
    const model = editorRef.current?.getModel();
    if (model) applyTabWidth(model, fileName, { tabSize, tabSizeOverrides });
  }, [tabSize, tabSizeOverrides, session]);

  // (Re)initialize content and regions whenever the generated result changes.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !initialResult || !session) return;

    const fileName = session.files.result.fileName;
    const model = monaco.editor.createModel(
      initialResult.lines.join("\n"),
      detectLanguage(fileName),
    );
    applyTabWidth(model, fileName, { tabSize, tabSizeOverrides });
    const previous = editor.getModel();
    suppressRef.current++;
    editor.setModel(model);
    previous?.dispose();
    suppressRef.current--;
    editor.updateOptions({ lineNumbersMinChars: lineNumberGutterChars(model.getLineCount()) });

    // Build one tracked decoration per region.
    const map = new Map<string, RegionInfo>();
    const stateGroups = useSession.getState().groups;
    const decorations = initialResult.regions.map((region) => {
      const group = stateGroups.find((g) => g.id === region.groupId);
      const empty = region.startLine === region.endLine;
      const range = empty
        ? new monaco.Range(
            Math.max(1, region.startLine + 1),
            1,
            Math.max(1, region.startLine + 1),
            1,
          )
        : new monaco.Range(
            region.startLine + 1,
            1,
            region.endLine,
            model.getLineMaxColumn(region.endLine),
          );
      return {
        range,
        options: {
          className: empty
            ? undefined
            : regionClass(group?.status ?? "resolved", group?.classification ?? ""),
          isWholeLine: !empty,
          linesDecorationsClassName: empty ? undefined : "msr-stripe",
          stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
        },
      };
    });
    const ids = model.deltaDecorations([], decorations);
    initialResult.regions.forEach((region, i) => {
      map.set(region.groupId, {
        decorationId: ids[i],
        collapsedAtLine: region.startLine === region.endLine ? region.startLine + 1 : null,
      });
    });
    regionsRef.current = map;

    // Detect user edits inside regions.
    const editSub = model.onDidChangeContent((e) => {
      if (suppressRef.current > 0) return;
      const changed: string[] = [];
      for (const [groupId] of regionsRef.current) {
        const span = controller.getRegionSpan(groupId);
        if (!span) continue;
        for (const change of e.changes) {
          const from = change.range.startLineNumber;
          const to = change.range.endLineNumber;
          if (to >= span.startLine && from <= Math.max(span.startLine, span.endLine - 1)) {
            changed.push(groupId);
            break;
          }
        }
      }
      if (changed.length > 0) useSession.getState().onRegionsEdited(changed);
    });

    return () => {
      editSub.dispose();
    };
  }, [initialResult, session]);

  // Repaint decoration classes when group states change.
  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;
    suppressRef.current++;
    try {
      for (const group of groups) {
        const info = regionsRef.current.get(group.id);
        if (!info || info.collapsedAtLine !== null) continue;
        const range = model.getDecorationRange(info.decorationId);
        if (!range) continue;
        const [newId] = model.deltaDecorations(
          [info.decorationId],
          [
            {
              range,
              options: {
                className: regionClass(group.status, group.classification),
                isWholeLine: true,
                linesDecorationsClassName: "msr-stripe",
                stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
              },
            },
          ],
        );
        info.decorationId = newId;
      }
    } finally {
      suppressRef.current--;
    }
  }, [groups]);

  const controller: ResultController = {
    getRegionSpan(groupId) {
      const editor = editorRef.current;
      const model = editor?.getModel();
      const info = regionsRef.current.get(groupId);
      if (!model || !info) return null;
      if (info.collapsedAtLine !== null) {
        return { startLine: info.collapsedAtLine, endLine: info.collapsedAtLine };
      }
      const range = model.getDecorationRange(info.decorationId);
      if (!range) return null;
      return { startLine: range.startLineNumber, endLine: range.endLineNumber + 1 };
    },

    getRegionLines(groupId) {
      const model = editorRef.current?.getModel();
      const span = this.getRegionSpan(groupId);
      if (!model || !span || span.startLine === span.endLine) return [];
      const lines: string[] = [];
      for (let l = span.startLine; l < span.endLine && l <= model.getLineCount(); l++) {
        lines.push(model.getLineContent(l));
      }
      return lines;
    },

    replaceRegion(groupId, lines) {
      const editor = editorRef.current;
      const model = editor?.getModel();
      const info = regionsRef.current.get(groupId);
      const span = this.getRegionSpan(groupId);
      if (!editor || !model || !info || !span) return;

      suppressRef.current++;
      try {
        let edit: monaco.editor.IIdentifiedSingleEditOperation;
        const lineCount = model.getLineCount();

        if (span.startLine === span.endLine) {
          // Collapsed region: insert before `startLine`.
          if (lines.length === 0) return;
          if (span.startLine <= lineCount) {
            edit = {
              range: new monaco.Range(span.startLine, 1, span.startLine, 1),
              text: lines.join("\n") + "\n",
            };
          } else {
            const lastCol = model.getLineMaxColumn(lineCount);
            edit = {
              range: new monaco.Range(lineCount, lastCol, lineCount, lastCol),
              text: "\n" + lines.join("\n"),
            };
          }
        } else if (lines.length > 0) {
          const endLine = Math.min(span.endLine - 1, lineCount);
          edit = {
            range: new monaco.Range(span.startLine, 1, endLine, model.getLineMaxColumn(endLine)),
            text: lines.join("\n"),
          };
        } else {
          // Delete the whole region including one line break.
          const endLine = Math.min(span.endLine - 1, lineCount);
          if (endLine < lineCount) {
            edit = { range: new monaco.Range(span.startLine, 1, endLine + 1, 1), text: "" };
          } else if (span.startLine > 1) {
            edit = {
              range: new monaco.Range(
                span.startLine - 1,
                model.getLineMaxColumn(span.startLine - 1),
                endLine,
                model.getLineMaxColumn(endLine),
              ),
              text: "",
            };
          } else {
            edit = {
              range: new monaco.Range(1, 1, endLine, model.getLineMaxColumn(endLine)),
              text: "",
            };
          }
        }

        editor.executeEdits("mergescope-resolution", [edit]);

        // Re-anchor the decoration to the new span.
        if (lines.length === 0) {
          const anchor = Math.min(span.startLine, model.getLineCount() + 1);
          model.deltaDecorations([info.decorationId], []);
          info.decorationId = model.deltaDecorations(
            [],
            [
              {
                range: new monaco.Range(
                  Math.min(anchor, model.getLineCount()),
                  1,
                  Math.min(anchor, model.getLineCount()),
                  1,
                ),
                options: {
                  stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
                },
              },
            ],
          )[0];
          info.collapsedAtLine = anchor;
        } else {
          const newEnd = span.startLine + lines.length - 1;
          const group = useSession.getState().groups.find((g) => g.id === groupId);
          info.decorationId = model.deltaDecorations(
            [info.decorationId],
            [
              {
                range: new monaco.Range(span.startLine, 1, newEnd, model.getLineMaxColumn(newEnd)),
                options: {
                  className: regionClass(group?.status ?? "resolved", group?.classification ?? ""),
                  isWholeLine: true,
                  linesDecorationsClassName: "msr-stripe",
                  stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
                },
              },
            ],
          )[0];
          info.collapsedAtLine = null;
        }
      } finally {
        suppressRef.current--;
      }
    },

    getText() {
      return editorRef.current?.getModel()?.getValue(monaco.editor.EndOfLinePreference.LF) ?? "";
    },

    revealGroup(groupId) {
      const editor = editorRef.current;
      const span = this.getRegionSpan(groupId);
      if (!editor || !span) return;
      const line = Math.max(1, span.startLine);
      editor.revealLineInCenterIfOutsideViewport(line);
      editor.setPosition({ lineNumber: line, column: 1 });
    },

    focus() {
      editorRef.current?.focus();
    },
  };

  // Publish the controller.
  useEffect(() => {
    editors.result = controller;
    return () => {
      if (editors.result === controller) delete editors.result;
    };
  });

  return (
    <section className="panel result-panel" aria-label="Merged result">
      <ResolutionToolbar />
      <div ref={containerRef} className="editor-host" />
    </section>
  );
}
