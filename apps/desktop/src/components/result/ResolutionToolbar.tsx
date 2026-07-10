import { useState } from "react";
import { useSession } from "../../stores/session";
import { isConflicting } from "@mergescope/merge-engine";

const CLASSIFICATION_LABEL: Record<string, string> = {
  independent: "Independent changes",
  overlapping: "Overlapping changes",
  "current-only": "Current only",
  "incoming-only": "Incoming only",
  "same-change": "Same change",
  "delete-modify": "Delete vs modify",
  unknown: "Unclassified",
};

export function ResolutionToolbar() {
  const groups = useSession((s) => s.groups);
  const activeIndex = useSession((s) => s.activeIndex);
  const applyStrategy = useSession((s) => s.applyStrategy);
  const resetGroup = useSession((s) => s.resetGroup);
  const markReviewed = useSession((s) => s.markReviewed);
  const next = useSession((s) => s.nextConflict);
  const prev = useSession((s) => s.prevConflict);
  const readonly = useSession((s) => s.session?.cli.readonly ?? false);
  const [bothOpen, setBothOpen] = useState(false);

  const group = groups[activeIndex];
  const disabled = !group || readonly;

  return (
    <div className="toolbar" role="toolbar" aria-label="Resolution actions">
      <div className="toolbar-group">
        <button onClick={prev} title="Previous conflict (Alt+Up)" aria-label="Previous conflict">
          ▲
        </button>
        <button onClick={next} title="Next conflict (Alt+Down)" aria-label="Next conflict">
          ▼
        </button>
        <span className="toolbar-counter">
          {groups.length > 0 ? `${activeIndex + 1}/${groups.length}` : "0/0"}
        </span>
        {group && (
          <span
            className={`badge badge-${group.classification} badge-status-${group.status}`}
            title={`Status: ${group.status}`}
          >
            {CLASSIFICATION_LABEL[group.classification] ?? group.classification}
          </span>
        )}
      </div>

      <div className="toolbar-group">
        <button
          disabled={disabled}
          onClick={() => group && applyStrategy(group.id, "current")}
          title="Accept Current (Alt+1)"
        >
          Accept Current
        </button>
        <button
          disabled={disabled}
          onClick={() => group && applyStrategy(group.id, "incoming")}
          title="Accept Incoming (Alt+2)"
        >
          Accept Incoming
        </button>
        <div className="dropdown">
          <button
            disabled={disabled}
            onClick={() => group && applyStrategy(group.id, "both-current-first")}
            title="Accept Both (Alt+3)"
          >
            Accept Both
          </button>
          <button
            className="dropdown-toggle"
            disabled={disabled}
            aria-label="Both: choose order"
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
                Both — Current first
              </button>
              <button
                onClick={() => {
                  applyStrategy(group.id, "both-incoming-first");
                  setBothOpen(false);
                }}
              >
                Both — Incoming first
              </button>
            </div>
          )}
        </div>
        <button
          disabled={disabled}
          onClick={() => group && applyStrategy(group.id, "base")}
          title="Accept Base (revert to the common ancestor)"
        >
          Accept Base
        </button>
        <button
          disabled={disabled}
          onClick={() => group && applyStrategy(group.id, "none")}
          title="Reject Both (keep the base content)"
        >
          Reject Both
        </button>
      </div>

      <div className="toolbar-group">
        <button
          disabled={disabled || group?.status === "unresolved"}
          onClick={() => group && markReviewed(group.id)}
          title="Mark as reviewed"
        >
          Mark Reviewed
        </button>
        <button
          disabled={disabled || (group ? !isConflicting(group) && !group.resolution : true)}
          onClick={() => group && resetGroup(group.id)}
          title="Reset this conflict to its initial state"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
