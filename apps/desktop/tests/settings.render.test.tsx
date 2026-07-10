import { afterAll, describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SettingsPanel } from "../src/components/settings/SettingsPanel";
import { useSession } from "../src/stores/session";
import i18n from "../src/i18n";

/**
 * Integration smoke test: the Settings panel must mount with the i18n runtime
 * and render the active language — the closest we can drive end-to-end without a
 * browser (Monaco editors can't run under jsdom). Rendered on the client so the
 * live store state (settingsOpen) is reflected.
 */
function renderPanel(): string {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(<SettingsPanel />));
  const html = container.innerHTML;
  root.unmount();
  container.remove();
  return html;
}

describe("SettingsPanel render", () => {
  afterAll(async () => {
    await i18n.changeLanguage("en");
    useSession.getState().setSettingsOpen(false);
  });

  it("renders localized content in Português when the language switches", async () => {
    await i18n.changeLanguage("pt-br");
    useSession.getState().setSettingsOpen(true);

    const html = renderPanel();

    expect(html).toContain("Configurações"); // title
    expect(html).toContain("Aparência"); // active tab
    expect(html).toContain("Atalhos"); // another tab
    expect(html).toContain("Tema"); // localized content of the active tab
  });

  it("renders nothing when closed", () => {
    useSession.getState().setSettingsOpen(false);
    expect(renderPanel()).toBe("");
  });
});
