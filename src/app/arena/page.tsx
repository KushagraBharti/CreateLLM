"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { categories } from "@/lib/categories";
import { getDefaultModels } from "@/lib/models";
import { useBenchmarkSSE } from "@/hooks/useBenchmarkSSE";
import CategorySelector from "@/components/arena/CategorySelector";
import PromptInput from "@/components/arena/PromptInput";
import ArenaRunner from "@/components/arena/ArenaRunner";
import WinnerReveal from "@/components/arena/WinnerReveal";
import ResultsView from "@/components/results/ResultsView";
import Button from "@/components/ui/Button";
import ModelSelector from "@/components/arena/ModelSelector";
import HumanCritiquePanel from "@/components/arena/HumanCritiquePanel";

export default function ArenaPage() {
  return (
    <Suspense>
      <ArenaContent />
    </Suspense>
  );
}

function ArenaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || categories[0].id;
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [prompt, setPrompt] = useState("");
  const [showWinner, setShowWinner] = useState(false);
  const [selectedModelIds, setSelectedModelIds] = useState(
    getDefaultModels().map((model) => model.id)
  );
  const [customModelIds, setCustomModelIds] = useState<string[]>([]);
  const prevStatusRef = useRef<string | null>(null);

  const {
    runId,
    isRunning,
    status,
    step,
    result,
    error,
    hasResults,
    startBenchmark,
    pauseBenchmark,
    cancelBenchmark,
    proceedBenchmark,
    resumeBenchmark,
    restartBenchmark,
    pauseModel,
    resumeModel,
    retryModel,
    cancelModel,
    submitHumanCritiques,
    streamingText,
    toolActivity,
    reasoningActivity,
  } = useBenchmarkSSE();

  useEffect(() => {
    if (prevStatusRef.current !== "complete" && status === "complete" && result) {
      setShowWinner(true);
    }
    prevStatusRef.current = status;
  }, [status, result]);

  useEffect(() => {
    if (runId) {
      router.replace(`/arena/${runId}`);
    }
  }, [router, runId]);

  const totalSelectedModels = selectedModelIds.length + customModelIds.length;
  const canStart = prompt.trim().length > 0 && totalSelectedModels >= 2 && totalSelectedModels <= 8 && !isRunning;

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!canStart) return;
      const runId = await startBenchmark({
        categoryId,
        prompt: prompt.trim(),
        selectedModelIds,
        customModelIds,
      });
      if (runId) {
        router.push(`/arena/${runId}`);
      }
    },
    [canStart, categoryId, customModelIds, prompt, router, selectedModelIds, startBenchmark]
  );

  const handleQuickRun = useCallback(
    async (examplePrompt: string) => {
      if (isRunning) return;
      setPrompt(examplePrompt);
      const runId = await startBenchmark({
        categoryId,
        prompt: examplePrompt,
        selectedModelIds,
        customModelIds,
      });
      if (runId) {
        router.push(`/arena/${runId}`);
      }
    },
    [categoryId, customModelIds, isRunning, router, selectedModelIds, startBenchmark]
  );

  const selectionState = useMemo(
    () => ({ selectedModelIds, customModelIds }),
    [customModelIds, selectedModelIds]
  );
  const showRunWorkspace = Boolean(status && status !== "complete" && status !== "canceled");

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <AnimatePresence mode="wait">
        {!showRunWorkspace ? (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <form onSubmit={handleSubmit}>
              <div className="relative border border-border rounded-xl overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

                <div className="grid grid-cols-1 lg:grid-cols-2">
                  {/* Left: Domain + Prompt */}
                  <div className="p-6 lg:p-8 space-y-6 border-b lg:border-b-0 lg:border-r border-border">
                    <CategorySelector selectedId={categoryId} onSelect={setCategoryId} disabled={isRunning} />
                    <PromptInput
                      value={prompt}
                      onChange={setPrompt}
                      categoryId={categoryId}
                      disabled={isRunning}
                      onQuickRun={handleQuickRun}
                    />
                  </div>

                  {/* Right: Models */}
                  <div className="p-6 lg:p-8 flex flex-col min-h-0">
                    <ModelSelector
                      selectedModelIds={selectionState.selectedModelIds}
                      customModelIds={selectionState.customModelIds}
                      onChange={({ selectedModelIds: nextSelected, customModelIds: nextCustom }) => {
                        setSelectedModelIds(nextSelected);
                        setCustomModelIds(nextCustom);
                      }}
                      disabled={isRunning}
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" size="lg" disabled={!canStart} className="w-full mt-5">
                Enter the Arena
              </Button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start justify-between gap-4 border-l-2 border-accent/30 pl-5 py-1"
          >
            <div>
              <p className="label mb-1">Running</p>
              <p className="text-base text-text-primary capitalize">{categoryId}</p>
              <p className="text-sm text-text-muted line-clamp-2 mt-1">{prompt}</p>
            </div>
            <div className="flex items-center gap-3">
              {["queued", "generating", "critiquing", "revising", "voting"].includes(status ?? "") && (
                <Button type="button" variant="ghost" onClick={() => void pauseBenchmark()}>
                  Pause
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => void cancelBenchmark()}>
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-10">
        <AnimatePresence mode="wait">
          {status ? (
            <motion.div key="arena" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              {status === "awaiting_human_critique" && result && (
                <HumanCritiquePanel
                  run={result}
                  onSubmit={async (critiques) => {
                    await submitHumanCritiques(critiques);
                  }}
                  onProceed={async () => {
                    await proceedBenchmark();
                  }}
                />
              )}

              {result && status && (
                <ArenaRunner
                  status={status}
                  step={step}
                  run={result}
                  onPauseRun={() => pauseBenchmark()}
                  onResumeRun={() => resumeBenchmark()}
                  onCancelRun={() => cancelBenchmark()}
                  onRestartRun={async () => {
                    const next = await restartBenchmark();
                    if (next?.id) {
                      router.push(`/arena/${next.id}`);
                    }
                  }}
                  onPauseModel={(modelId) => pauseModel(modelId)}
                  onResumeModel={(modelId) => resumeModel(modelId)}
                  onRetryModel={(modelId) => retryModel(modelId)}
                  onCancelModel={(modelId) => cancelModel(modelId)}
                />
              )}

              {hasResults && result && (
                <ResultsView
                  run={result}
                  isLive={isRunning}
                  streamingText={streamingText}
                  toolActivity={toolActivity}
                  reasoningActivity={reasoningActivity}
                />
              )}

              {error && (
                <div className="border border-[#C75050]/40 bg-[#C75050]/8 rounded-xl p-4 text-base text-text-secondary">
                  {error}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <p className="font-display text-8xl sm:text-[11rem] text-border/50 leading-none mb-4 select-none">
                {totalSelectedModels}
              </p>
              <p className="text-text-muted text-sm max-w-sm text-center leading-relaxed">
                From a head-to-head duel to an eight-model battle royale — pick your competitors and write a prompt to begin.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {result && status === "complete" && (
        <WinnerReveal run={result} show={showWinner} onDismiss={() => setShowWinner(false)} />
      )}
    </div>
  );
}
