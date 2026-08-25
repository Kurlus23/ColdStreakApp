import "./_group.css";

const metrics = [
  { label: "Last Plunge", value: "1859" },
  { label: "Today", value: "—" },
  { label: "All Time", value: "9722" },
];

export function Current() {
  return (
    <main className="mockup-shell">
      <section className="friend-card" aria-label="Current Friends Brain Freeze stats">
        <div className="friend-heading">
          <div className="friend-avatar" aria-hidden="true">♙</div>
          <div>
            <h1 className="friend-name">Friend</h1>
            <p className="friend-meta">— Not yet today · Brain Freeze</p>
          </div>
        </div>

        <div className="metrics">
          {metrics.map((metric, index) => (
            <div className="metric" key={metric.label}>
              {index === 0 ? (
                <div className="current-metric">
                  <img src="/__mockup/images/brain-freeze-icon.png" alt="" />
                  <span className="current-label">{metric.label}</span>
                </div>
              ) : (
                <span className="metric-label">{metric.label}</span>
              )}
              <span className="metric-value">{metric.value}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}