const answers = [
  { letter: "A", text: "Brown fat" },
  { letter: "B", text: "Muscle fiber" },
  { letter: "C", text: "White blood cells" },
  { letter: "D", text: "Skin cells" },
];

export function Question() {
  return (
    <div
      className="w-[390px] h-[844px] overflow-hidden flex flex-col"
      style={{
        backgroundColor: "#071428",
        color: "#e2e8f0",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <header
        className="h-[40px] shrink-0 flex items-center justify-center border-b"
        style={{
          backgroundColor: "#0f1f3d",
          borderColor: "rgba(148, 163, 184, 0.16)",
          color: "#94a3b8",
        }}
        aria-label="Plunge status"
      >
        <div className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.08em]">
          <span>02:47</span>
          <span style={{ color: "#526987" }}>·</span>
          <span>39°F</span>
          <span style={{ color: "#526987" }}>·</span>
          <span aria-label="three day streak" style={{ color: "#f59e0b" }}>
            🔥🔥🔥
          </span>
        </div>
      </header>

      <div
        className="h-[7px] shrink-0 w-full"
        style={{ backgroundColor: "#172b4a" }}
        role="progressbar"
        aria-label="Question time remaining"
        aria-valuemin={0}
        aria-valuemax={15}
        aria-valuenow={9}
      >
        <div
          className="h-full"
          style={{
            width: "60%",
            backgroundColor: "#f59e0b",
            boxShadow: "0 0 10px rgba(245, 158, 11, 0.24)",
          }}
        />
      </div>

      <main className="flex min-h-0 flex-1 flex-col px-5 pt-[54px]">
        <section className="flex min-h-[164px] shrink-0 items-start justify-center text-center">
          <h1 className="max-w-[345px] text-[24px] font-bold leading-[1.22] tracking-[-0.025em]">
            Which tissue generates heat without shivering?
          </h1>
        </section>

        <section
          className="flex flex-1 flex-col justify-end gap-3 pb-5"
          aria-label="Answers"
        >
          {answers.map((answer) => (
            <button
              key={answer.letter}
              type="button"
              className="flex h-[100px] w-full shrink-0 items-center gap-5 rounded-[10px] border px-5 text-left transition-transform active:scale-[0.985]"
              style={{
                backgroundColor: "#1e3a5f",
                borderColor: "rgba(148, 163, 184, 0.27)",
                color: "#e2e8f0",
              }}
              onClick={() => undefined}
              aria-label={`${answer.letter}: ${answer.text}`}
            >
              <span
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[7px] border text-[17px] font-bold"
                style={{
                  borderColor: "rgba(34, 211, 238, 0.55)",
                  backgroundColor: "rgba(7, 20, 40, 0.5)",
                  color: "#22d3ee",
                }}
              >
                {answer.letter}
              </span>
              <span className="text-[19px] font-semibold tracking-[-0.01em]">
                {answer.text}
              </span>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}