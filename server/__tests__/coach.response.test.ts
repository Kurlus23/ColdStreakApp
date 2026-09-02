import { describe, expect, it } from "vitest";
import { normalizeCoachReply } from "@shared/coach";

describe("coach response normalization", () => {
  it("unwraps a normal JSON response", () => {
    expect(normalizeCoachReply('{"reply":"Use the Timer tab.","navigate":"timer"}')).toEqual({
      reply: "Use the Timer tab.",
      navigate: "timer",
    });
  });

  it("unwraps a markdown-fenced response", () => {
    expect(normalizeCoachReply("```json\n{\"reply\":\"Open Profile → Stats.\"}\n```")).toEqual({
      reply: "Open Profile → Stats.",
      navigate: null,
    });
  });

  it("keeps the reply from an incomplete JSON envelope", () => {
    expect(normalizeCoachReply('{"reply":"The Benefits Bar tracks four concurrent rails')).toEqual({
      reply: "The Benefits Bar tracks four concurrent rails",
      navigate: null,
    });
  });

  it("unwraps a response accidentally nested inside reply", () => {
    expect(normalizeCoachReply('{"reply":"{\\"reply\\":\\"Try a shorter plunge first.\\"}"}')).toEqual({
      reply: "Try a shorter plunge first.",
      navigate: null,
    });
  });

  it("leaves a plain-text response readable", () => {
    expect(normalizeCoachReply("Start slowly and never plunge alone.")).toEqual({
      reply: "Start slowly and never plunge alone.",
      navigate: null,
    });
  });
});