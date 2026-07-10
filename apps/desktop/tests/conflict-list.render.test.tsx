import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ConflictList } from "../src/components/conflicts/ConflictList";
import { useSession } from "../src/stores/session";
import { getCommandActions } from "../src/features/commands";

let cleanup: (() => void) | undefined;
const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

beforeAll(() => {
  reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT;
});

function renderList() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<ConflictList />));
  cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };
  return container;
}

describe("ConflictList", () => {
  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    useSession.getState().setPrefs({
      conflictListWidth: 230,
      conflictListCollapsed: false,
      showConflictList: true,
    });
  });

  it("uses the saved width and exposes an accessible resize handle", () => {
    useSession.getState().setPrefs({ conflictListWidth: 320, conflictListCollapsed: false });
    const container = renderList();
    const aside = container.querySelector("aside");
    const separator = container.querySelector('[role="separator"]');

    expect(aside?.style.width).toBe("320px");
    expect(separator?.getAttribute("aria-valuenow")).toBe("320");
  });

  it("toggles visibility without changing the compact state", () => {
    useSession.getState().setPrefs({
      showConflictList: true,
      conflictListCollapsed: true,
    });

    getCommandActions()["toggle-list"]();
    expect(useSession.getState().prefs.showConflictList).toBe(false);
    expect(useSession.getState().prefs.conflictListCollapsed).toBe(true);

    getCommandActions()["toggle-list"]();
    expect(useSession.getState().prefs.showConflictList).toBe(true);
    expect(useSession.getState().prefs.conflictListCollapsed).toBe(true);
  });

  it("collapses to the compact width and can expand again", () => {
    useSession.getState().setPrefs({ conflictListWidth: 300, conflictListCollapsed: true });
    const container = renderList();
    const aside = container.querySelector("aside");
    const toggle = container.querySelector<HTMLButtonElement>(".conflict-list-toggle");

    expect(aside?.classList.contains("collapsed")).toBe(true);
    expect(aside?.style.width).toBe("58px");
    expect(container.querySelector('[role="separator"]')).toBeNull();

    act(() => toggle?.click());

    expect(aside?.classList.contains("collapsed")).toBe(false);
    expect(aside?.style.width).toBe("300px");
  });
});
