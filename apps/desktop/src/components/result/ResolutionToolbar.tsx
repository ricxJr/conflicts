import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../../stores/session";
import { isConflicting } from "@mergescope/merge-engine";
import { effectiveKeybindings, formatChord } from "../../features/keybindings";

export function ResolutionToolbar() {
  const { t } = useTranslation();
  const groups = useSession((s) => s.groups);
  const activeIndex = useSession((s) => s.activeIndex);
  const applyStrategy = useSession((s) => s.applyStrategy);
  const resetGroup = useSession((s) => s.resetGroup);
  const markReviewed = useSession((s) => s.markReviewed);
  const next = useSession((s) => s.nextConflict);
  const prev = useSession((s) => s.prevConflict);
  const readonly = useSession((s) => s.session?.cli.readonly ?? false);
  const kb = useSession((s) => effectiveKeybindings(s.prefs.keybindings));
  const [bothOpen, setBothOpen] = useState(false);

  const group = groups[activeIndex];
  const disabled = !group || readonly;

  const withKey = (label: string, id: string) =>
    kb[id] ? `${label} (${formatChord(kb[id])})` : label;

  return (
    <div className="toolbar" role="toolbar" aria-label={t("toolbar.aria")}>
      <div className="toolbar-group">
        <button
          onClick={prev}
          title={withKey(t("tooltip.prev"), "prev")}
          aria-label={t("toolbar.prev")}
        >
          ▲
        </button>
        <button
          onClick={next}
          title={withKey(t("tooltip.next"), "next")}
          aria-label={t("toolbar.next")}
        >
          ▼
        </button>
        <span className="toolbar-counter">
          {groups.length > 0 ? `${activeIndex + 1}/${groups.length}` : "0/0"}
        </span>
        {group && (
          <span
            className={`badge badge-${group.classification} badge-status-${group.status}`}
            title={t("toolbar.statusTitle", { status: t(`groupStatus.${group.status}`) })}
          >
            {t(`classification.${group.classification}`)}
          </span>
        )}
      </div>

      <div className="toolbar-group">
        <button
          disabled={disabled}
          onClick={() => group && applyStrategy(group.id, "current")}
          title={withKey(t("tooltip.acceptCurrent"), "accept-current")}
        >
          {t("action.acceptCurrent")}
        </button>
        <button
          disabled={disabled}
          onClick={() => group && applyStrategy(group.id, "incoming")}
          title={withKey(t("tooltip.acceptIncoming"), "accept-incoming")}
        >
          {t("action.acceptIncoming")}
        </button>
        <div className="dropdown">
          <button
            disabled={disabled}
            onClick={() => group && applyStrategy(group.id, "both-current-first")}
            title={withKey(t("tooltip.acceptBoth"), "accept-both")}
          >
            {t("action.acceptBoth")}
          </button>
          <button
            className="dropdown-toggle"
            disabled={disabled}
            aria-label={t("toolbar.bothOrder")}
            onClick={() => setBothOpen((v) => !v)}
          >
            ▾
          </button>
          {bothOpen && group && (
            <div className="dropdown-menu" onMouseLeave={() => setBothOpen(false)}>
              <button
                onClick={() => {
                  applyStrategy(group.id, "both-current-first");
                  setBothOpen(false);
                }}
              >
                {t("action.bothCurrentFirst")}
              </button>
              <button
                onClick={() => {
                  applyStrategy(group.id, "both-incoming-first");
                  setBothOpen(false);
                }}
              >
                {t("action.bothIncomingFirst")}
              </button>
            </div>
          )}
        </div>
        <button
          disabled={disabled}
          onClick={() => group && applyStrategy(group.id, "base")}
          title={t("tooltip.acceptBase")}
        >
          {t("action.acceptBase")}
        </button>
        <button
          disabled={disabled}
          onClick={() => group && applyStrategy(group.id, "none")}
          title={t("tooltip.rejectBoth")}
        >
          {t("action.rejectBoth")}
        </button>
      </div>

      <div className="toolbar-group">
        <button
          disabled={disabled || group?.status === "unresolved"}
          onClick={() => group && markReviewed(group.id)}
          title={t("tooltip.markReviewed")}
        >
          {t("action.markReviewed")}
        </button>
        <button
          disabled={disabled || (group ? !isConflicting(group) && !group.resolution : true)}
          onClick={() => group && resetGroup(group.id)}
          title={t("tooltip.reset")}
        >
          {t("action.reset")}
        </button>
      </div>
    </div>
  );
}
