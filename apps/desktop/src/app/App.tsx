import { useEffect } from "react";
import { useSession } from "../stores/session";
import { applyTheme } from "../editor/monaco";
import { TopBar } from "../components/layout/TopBar";
import { StatusBar } from "../components/layout/StatusBar";
import { SplitPane } from "../components/layout/SplitPane";
import { DiffPanel } from "../components/diff/DiffPanel";
import { BaseViewer } from "../components/diff/BaseViewer";
import { ResultPanel } from "../components/result/ResultPanel";
import { ConflictList } from "../components/conflicts/ConflictList";
import { CommandPalette } from "../components/commands/CommandPalette";
import { DialogHost } from "../components/dialogs/DialogHost";
import { useShortcuts } from "../features/shortcuts";
import { attachScrollSync } from "../features/scrollSync";

export function App() {
  const phase = useSession((s) => s.phase);
  const errorMessage = useSession((s) => s.errorMessage);
  const session = useSession((s) => s.session);
  const prefs = useSession((s) => s.prefs);
  const setPrefs = useSession((s) => s.setPrefs);
  const init = useSession((s) => s.init);

  useShortcuts();

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    applyTheme(prefs.theme);
  }, [prefs.theme]);

  // Attach scroll sync after the editors exist.
  useEffect(() => {
    if (phase !== "ready") return;
    const timer = setTimeout(() => attachScrollSync(), 100);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "loading") {
    return (
      <div className="app-message" role="status">
        Loading merge session…
      </div>
    );
  }

  if (phase === "error" || !session) {
    return (
      <div className="app-message app-error" role="alert">
        <h1>MergeScope could not start</h1>
        <pre>{errorMessage}</pre>
        <p>
          Expected usage:{" "}
          <code>
            mergescope --base &lt;path&gt; --current &lt;path&gt; --incoming &lt;path&gt; --result
            &lt;path&gt;
          </code>
        </p>
      </div>
    );
  }

  const { files, cli } = session;
  const baseContent = files.base?.content ?? "";
  const currentLabel = cli.currentLabel ?? "CURRENT";
  const incomingLabel = cli.incomingLabel ?? "INCOMING";

  const topRow = (
    <div className="top-row">
      <DiffPanel
        side="left"
        title={`${currentLabel} vs BASE`}
        baseContent={baseContent}
        sideContent={files.current.content}
        fileName={files.result.fileName}
        filePath={files.current.path}
      />
      {prefs.showBasePanel && files.base && (
        <BaseViewer
          content={baseContent}
          fileName={files.result.fileName}
          filePath={files.base.path}
        />
      )}
      <DiffPanel
        side="right"
        title={`BASE vs ${incomingLabel}`}
        baseContent={baseContent}
        sideContent={files.incoming.content}
        fileName={files.result.fileName}
        filePath={files.incoming.path}
      />
    </div>
  );

  return (
    <div className="app">
      <TopBar />
      <div className="app-body">
        {prefs.showConflictList && <ConflictList />}
        <SplitPane
          direction="vertical"
          ratio={1 - prefs.resultPanelRatio}
          onRatioChange={(r) => setPrefs({ resultPanelRatio: 1 - r })}
          first={topRow}
          second={<ResultPanel />}
        />
      </div>
      <StatusBar />
      <CommandPalette />
      <DialogHost />
    </div>
  );
}
