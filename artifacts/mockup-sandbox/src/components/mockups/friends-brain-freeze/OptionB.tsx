import "./_group.css";

const metrics = [
  { label: "Last Plunge", value: "1859", emphasis: true },
  { label: "Today", value: "—", emphasis: false },
  { label: "All Time", value: "9722", emphasis: false },
];

export function OptionB() {
  return (
    <main className="mockup-shell">
      <section className="friend-card option-b-card" aria-label="Friend Brain Freeze score module">
        <div className="friend-heading">
          <div className="friend-avatar" aria-hidden="true">F</div>
          <div>
            <h1 className="friend-name">Friend</h1>
            <p className="friend-meta">— Not yet today</p>
          </div>
        </div>

        <div className="brain-freeze-module">
          <div className="module-heading">
            <div>
              <p className="module-kicker">FRIEND SCORE</p>
              <h2 className="module-title">Brain Freeze</h2>
            </div>
            <span className="module-status">SCORE</span>
          </div>
          <div className="module-rule" />

          <div className="metrics" aria-label="Brain Freeze scores">
            {metrics.map((metric) => (
              <div className={`metric${metric.emphasis ? " metric-primary" : ""}`} key={metric.label}>
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