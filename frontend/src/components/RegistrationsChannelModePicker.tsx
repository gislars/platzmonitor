import type { RegistrationsChannelMode } from "../registrationCharts";

type Props = {
  mode: RegistrationsChannelMode;
  onChange: (m: RegistrationsChannelMode) => void;
  onsitePossible: boolean;
  ariaLabel: string;
};

export function RegistrationsChannelModePicker({ mode, onChange, onsitePossible, ariaLabel }: Props) {
  return (
    <div className="stat-reg-chart__mode" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className={`stat-reg-chart__mode-btn${mode === "online" ? " stat-reg-chart__mode-btn--active" : ""}`}
        aria-pressed={mode === "online"}
        onClick={() => {
          onChange("online");
        }}
      >
        Online
      </button>
      <button
        type="button"
        className={`stat-reg-chart__mode-btn${mode === "onsite" ? " stat-reg-chart__mode-btn--active" : ""}`}
        aria-pressed={mode === "onsite"}
        disabled={!onsitePossible}
        onClick={() => {
          onChange("onsite");
        }}
      >
        vor Ort
      </button>
      <button
        type="button"
        className={`stat-reg-chart__mode-btn${mode === "total" ? " stat-reg-chart__mode-btn--active" : ""}`}
        aria-pressed={mode === "total"}
        onClick={() => {
          onChange("total");
        }}
      >
        Gesamt
      </button>
    </div>
  );
}
