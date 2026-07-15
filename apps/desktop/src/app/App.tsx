import { useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { SettingsPanel } from "../components/settings/SettingsPanel";
import { DialogHost } from "../components/dialogs/DialogHost";
import { useShortcuts } from "../features/shortcuts";
import { attachScrollSync } from "../features/scrollSync";
import { attachPanelAlignment } from "../features/panelAlignment";

export function App() {
  const { t } = useTranslation();
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
    applyTheme(prefs);
  }, [prefs.theme, prefs.customTheme, prefs.uiFontFamily, prefs.uiFontSize]);

  // Attach scroll sync and cross-panel alignment after the editors exist.
  useEffect(() => {
    if (phase !== "ready") return;
    const detach: (() => void)[] = [];
    const timer = setTimeout(() => {
      detach.push(attachScrollSync(), attachPanelAlignment());
    }, 100);
    return () => {
      clearTimeout(timer);
      detach.forEach((d) => d());
    };
  }, [phase]);

  if (phase === "loading") {
    return (
      <div className="app-message" role="status">
        {t("app.loading")}
      </div>
    );
  }

  if (phase === "error" || !session) {
    return (
      <div className="app-message app-error" role="alert">
        <h1>{t("app.startError")}</h1>
        <pre>{errorMessage}</pre>
        <p>
          {t("app.expectedUsage")}{" "}
          <code>
            mergescope --base &lt;path&gt; --current &lt;path&gt; --incoming &lt;path&gt; --result
            &lt;path&gt;
          </code>
        </p>
      </div>
    );
  }

  const { files, cli, git } = session;
  const baseContent = files.base?.content ?? "";
  // Prefer the detected branch name over CLI labels like HEAD/CURRENT.
  const currentLabel = git?.currentBranch ?? cli.currentLabel ?? "CURRENT";
  const incomingLabel = git?.incomingBranch ?? cli.incomingLabel ?? "INCOMING";

  const topRow = (
    <div className="top-row">
      <DiffPanel
        side="left"
        title={t("panel.currentVsBase", { label: currentLabel })}
        roleLabel={t("panel.sideCurrent")}
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
        title={t("panel.incomingVsBase", { label: incomingLabel })}
        roleLabel={t("panel.sideIncoming")}
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
      <SettingsPanel />
      <DialogHost />
    </div>
  );
}
