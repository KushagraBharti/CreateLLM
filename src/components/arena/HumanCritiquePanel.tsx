"use client";

import { useState } from "react";
import { BenchmarkRun } from "@/types";
import Button from "@/components/ui/Button";
import { getModelIdentity } from "@/utils/model-identity";

interface HumanCritiquePanelProps {
  run: BenchmarkRun;
  disabled?: boolean;
  onSubmit: (payload: {
    targetModelId: string;
    ideaLabel: string;
    strengths: string;
    weaknesses: string;
    suggestions: string;
    score: number;
    authorLabel: string;
  }[]) => Promise<void>;
  onProceed: () => Promise<void>;
}

export default function HumanCritiquePanel({
  run,
  disabled,
  onSubmit,
  onProceed,
}: HumanCritiquePanelProps) {
  const [drafts, setDrafts] = useState<Record<string, { strengths: string; weaknesses: string; suggestions: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const critiques = Object.entries(drafts)
      .filter(([, draft]) => draft.strengths || draft.weaknesses || draft.suggestions)
      .map(([targetModelId, draft]) => ({
        targetModelId,
        ideaLabel: "H",
        strengths: draft.strengths,
        weaknesses: draft.weaknesses,
        suggestions: draft.suggestions,
        score: 7,
        authorLabel: "You",
      }));

    setSubmitting(true);
    try {
      if (critiques.length > 0) {
        await onSubmit(critiques);
      }
      await onProceed();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border border-border rounded-2xl p-6 bg-bg-surface/70">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <p className="label mb-2">Optional Human Critique</p>
          <p className="text-base text-text-secondary max-w-2xl">
            Add your own revision guidance before Stage 3. Leave everything blank and proceed to continue automatically.
          </p>
        </div>
        <Button onClick={handleSubmit} disabled={disabled || submitting}>
          {submitting ? "Submitting..." : "Proceed to Revision"}
        </Button>
      </div>

      <div className="space-y-4">
        {run.ideas
          .filter((idea) => !run.failedModels.includes(idea.modelId))
          .map((idea) => {
            const identity = getModelIdentity(idea.modelId);
            const draft = drafts[idea.modelId] ?? { strengths: "", weaknesses: "", suggestions: "" };

            return (
              <div key={idea.modelId} className="border border-border/70 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: identity.color }} />
                  <span className="text-text-primary font-medium">{identity.name}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(["strengths", "weaknesses", "suggestions"] as const).map((field) => (
                    <textarea
                      key={field}
                      value={draft[field]}
                      disabled={disabled || submitting}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [idea.modelId]: {
                            ...draft,
                            [field]: event.target.value,
                          },
                        }))
                      }
                      rows={4}
                      placeholder={field[0].toUpperCase() + field.slice(1)}
                      className="w-full rounded-lg border border-border bg-bg-deep px-3 py-2 text-sm text-text-primary"
                    />
                  ))}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
