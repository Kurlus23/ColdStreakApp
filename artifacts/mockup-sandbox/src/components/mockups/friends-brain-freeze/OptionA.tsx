import "./_group.css";

const metrics = [
  { label: "Last Plunge", value: "1859" },
  { label: "Today", value: "—" },
  { label: "All Time", value: "9722" },
];

export function OptionA() {
  return (
    <main className="mockup-shell">
      <section className="friend-card option-a-card" aria-label="Friend Brain Freeze stats">
        <div className="friend-heading">
          <div className="friend-avatar" aria-hidden="true">F</div>
          <div className="friend-identity">
            <h1 className="friend-name">Friend</h1>
            <p className="friend-meta">— Not yet today</p>
          </div>
        </div>

        <div className="brain-freeze-section">
          <div className="brain-freeze-label">
            <span className="label-rule" aria-hidden="true" />
            <span>Brain Freeze</span>
          </div>
          <div className="metrics">
            {metrics.map((metric) => (
              <div className="metric" key={metric.label}>
                <span className="metric-label">{metric.label}</span>
                <span className="metric-value">{metric.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}