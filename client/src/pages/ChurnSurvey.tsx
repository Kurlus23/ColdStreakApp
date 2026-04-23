import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type SurveyData = {
  id: number;
  email: string;
  displayName: string | null;
  daysInactive: number;
  alreadyResponded: boolean;
};

const REASONS: Array<{ value: string; label: string; emoji: string }> = [
  { value: "too_cold", label: "Too cold / too hard", emoji: "🥶" },
  { value: "lost_interest", label: "Lost interest", emoji: "😴" },
  { value: "life_busy", label: "Life got busy", emoji: "📅" },
  { value: "app_issue", label: "Something in the app didn't work", emoji: "🐞" },
  { value: "found_other", label: "I'm using a different tool now", emoji: "🔁" },
  { value: "other", label: "Something else", emoji: "💬" },
];

export default function ChurnSurvey() {
  const [, params] = useRoute("/feedback/:token");
  const token = params?.token;
  const [reason, setReason] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [done, setDone] = useState(false);

  const { data, isLoading, error } = useQuery<SurveyData>({
    queryKey: ["/api/churn-survey", token],
    enabled: !!token,
  });

  const submit = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/churn-survey/${token}`, { reason, comment: comment.trim() || undefined });
    },
    onSuccess: () => setDone(true),
  });

  if (!token) {
    return <Shell><Heading>Missing survey link</Heading></Shell>;
  }

  if (isLoading) {
    return <Shell><p className="text-blue-300 text-sm">Loading…</p></Shell>;
  }

  if (error || !data) {
    return (
      <Shell>
        <Heading>This survey link isn't valid</Heading>
        <p className="text-blue-300 text-sm mt-2">It may have expired or the link was mistyped. No worries — you can keep using ColdStreak as normal.</p>
        <a href="/" className="text-cyan-400 underline text-sm mt-6 inline-block" data-testid="link-home">Back to ColdStreak</a>
      </Shell>
    );
  }

  if (done || data.alreadyResponded) {
    return (
      <Shell>
        <p className="text-4xl mb-4">🙏</p>
        <Heading>Thanks for the feedback</Heading>
        <p className="text-blue-300 text-sm mt-2">Genuinely — this helps us make ColdStreak better. The cold is always waiting if you change your mind.</p>
        <a href="/" className="text-cyan-400 underline text-sm mt-6 inline-block" data-testid="link-home">Back to ColdStreak</a>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-4xl mb-4">🧊</p>
      <Heading>{data.displayName ? `Hey ${data.displayName},` : "Hey,"} we miss you</Heading>
      <p className="text-blue-300 text-sm mt-2">
        It's been about <span className="text-white font-semibold">{data.daysInactive} days</span> since your last plunge. Mind telling us why?
      </p>

      <div className="mt-6 space-y-2">
        {REASONS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setReason(r.value)}
            data-testid={`button-reason-${r.value}`}
            className={`w-full text-left px-4 py-3 rounded-xl border transition ${
              reason === r.value
                ? "bg-cyan-500 border-cyan-400 text-blue-950 font-semibold"
                : "bg-blue-900/40 border-blue-800 text-blue-100 hover:bg-blue-900/70"
            }`}
          >
            <span className="mr-2">{r.emoji}</span>{r.label}
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything else you'd like to share? (optional)"
        rows={3}
        maxLength={2000}
        data-testid="input-comment"
        className="mt-4 w-full px-4 py-3 rounded-xl bg-blue-900/40 border border-blue-800 text-white text-sm placeholder-blue-400 focus:outline-none focus:border-cyan-400"
      />

      <button
        onClick={() => submit.mutate()}
        disabled={!reason || submit.isPending}
        data-testid="button-submit"
        className="mt-4 w-full bg-cyan-500 text-blue-950 font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submit.isPending ? "Sending…" : "Submit"}
      </button>

      {submit.isError && (
        <p className="text-red-400 text-xs mt-3">Couldn't submit — please try again.</p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-white">{children}</div>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-bold">{children}</h1>;
}
