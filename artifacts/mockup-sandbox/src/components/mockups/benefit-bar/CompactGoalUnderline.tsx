import { useState } from "react";
import type { CSSProperties } from "react";
import "./_group.css";
import "./CompactGoalUnderline.css";

const segments = [
  {
    id: "energy",
    label: "Energy",
    color: "#41d7ea",
    glow: "rgba(65, 215, 234, .58)",
    progress: 100,
    value: "MAX",
    complete: true,
  },
  {
    id: "mood",
    label: "Mood",
    color: "#f4c85b",
    glow: "rgba(244, 200, 91, .48)",
    progress: 100,
    value: "MAX",
    complete: true,
  },
  {
    id: "metabolism",
    label: "Metabolism",
    color: "#f18a50",
    glow: "rgba(241, 138, 80, .5)",
    progress: 70,
    value: "1:30",
    complete: false,
  },
  {
    id: "recovery",
    label: "Recovery",
    color: "#70dfbd",
    glow: "rgba(112, 223, 189, .56)",
    progress: 70,
    value: "1:30",
    complete: false,
  },
] as const;

type GoalId = (typeof segments)[number]["id"];

export function CompactGoalUnderline() {
  const [goal, setGoal] = useState<GoalId>("recovery");
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <main className="compact-goal-underline">
      <section className="compact-goal-underline__panel" aria-label="ColdStreak benefit progress">
        <div className="compact-goal-underline__action-row">
          <button
            className="compact-goal-underline__action"
            type="button"
            aria-expanded={pickerOpen}
            aria-controls="compact-goal-picker"
            onClick={() => setPickerOpen((open) => !open)}
          >
            Tap to Set Goal
          </button>
        </div>

        {pickerOpen ? (
          <div className="compact-goal-underline__menu" id="compact-goal-picker" role="menu">
            <div className="compact-goal-underline__menu-label">Choose focus</div>
            {segments.map((segment) => (
              <button
                key={segment.id}
                className="compact-goal-underline__menu-option"
                type="button"
                role="menuitemradio"
                aria-current={goal === segment.id}
                style={{ "--option-color": segment.color } as CSSProperties}
                onClick={() => {
                  setGoal(segment.id);
                  setPickerOpen(false);
                }}
              >
                <span>{segment.label}</span>
                {goal === segment.id ? (
                  <span className="compact-goal-underline__check" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className="compact-goal-underline__rails" role="list" aria-label="Today's benefits">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className="compact-goal-underline__rail"
              role="listitem"
              data-selected={goal === segment.id}
              style={
                {
                  "--rail-color": segment.color,
                  "--rail-glow": segment.glow,
                  "--rail-progress": `${segment.progress}%`,
                } as CSSProperties
              }
              aria-label={`${segment.label}: ${segment.complete ? "complete" : `${segment.value} remaining`}${goal === segment.id ? ", current goal" : ""}`}
            >
              <span className="compact-goal-underline__label">{segment.label}</span>
              <div className="compact-goal-underline__track" aria-hidden="true">
                <span className="compact-goal-underline__fill" />
              </div>
              <span className="compact-goal-underline__value">{segment.value}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}