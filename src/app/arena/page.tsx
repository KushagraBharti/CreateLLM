"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
    isRunning,
    status,
    step,
    result,
    error,
    hasResults,
    startBenchmark,
    cancelBenchmark,
    proceedBenchmark,
    submitHumanCritiques,
    streamingText,
  } = useBenchmarkSSE();

  useEffect(() => {
    if (prevStatusRef.current !== "complete" && status === "complete" && result) {
      setShowWinner(true);
    }
    prevStatusRef.current = status;
  }, [status, result]);

  const totalSelectedModels = selectedModelIds.length + customModelIds.length;
  const canStart = prompt.trim().length > 0 && totalSelectedModels >= 2 && totalSelectedModels <= 8 && !isRunning;

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!canStart) return;
      await startBenchmark({
        categoryId,
        prompt: prompt.trim(),
        selectedModelIds,
        customModelIds,
      });
    },
    [canStart, categoryId, customModelIds, prompt, selectedModelIds, startBenchmark]
  );

  const handleQuickRun = useCallback(
    async (examplePrompt: string) => {
      if (isRunning) return;
      setPrompt(examplePrompt);
      await startBenchmark({
        categoryId,
        prompt: examplePrompt,
        selectedModelIds,
        customModelIds,
      });
    },
    [categoryId, customModelIds, isRunning, selectedModelIds, startBenchmark]
  );

  const selectionState = useMemo(
    () => ({ selectedModelIds, customModelIds }),
    [customModelIds, selectedModelIds]
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-12">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <AnimatePresence mode="wait">
            {!isRunning ? (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <CategorySelector selectedId={categoryId} onSelect={setCategoryId} disabled={isRunning} />
                  <PromptInput
                    value={prompt}
                    onChange={setPrompt}
                    categoryId={categoryId}
                    disabled={isRunning}
                    onQuickRun={handleQuickRun}
                  />
                  <ModelSelector
                    selectedModelIds={selectionState.selectedModelIds}
                    customModelIds={selectionState.customModelIds}
                    onChange={({ selectedModelIds: nextSelected, customModelIds: nextCustom }) => {
                      setSelectedModelIds(nextSelected);
                      setCustomModelIds(nextCustom);
                    }}
                    disabled={isRunning}
                  />
                  <Button type="submit" size="lg" disabled={!canStart} className="w-full">
                    Enter the Arena
                  </Button>
                </form>
              </motion.div>
            ) : (
              <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-l-2 border-border pl-4 space-y-4">
                <div>
                  <p className="label mb-2">Running</p>
                  <p className="text-base text-text-primary capitalize mb-1">{categoryId}</p>
                  <p className="text-base text-text-muted line-clamp-3">{prompt}</p>
                </div>
                <Button type="button" variant="ghost" onClick={() => void cancelBenchmark()}>
                  Cancel Run
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="min-w-0 space-y-8">
          <AnimatePresence mode="wait">
            {status ? (
              <motion.div key="arena" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                {(isRunning || status === "queued" || status === "awaiting_human_critique") && (
                  <ArenaRunner status={status} step={step} run={result} />
                )}

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

                {hasResults && result && (
                  <ResultsView run={result} isLive={isRunning} streamingText={streamingText} />
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
                className="flex flex-col justify-center min-h-[60vh]"
              >
                <p className="font-display text-6xl sm:text-8xl text-border leading-none mb-4">
                  {totalSelectedModels}
                </p>
                <p className="text-text-muted text-base max-w-sm">
                  Build anything from a head-to-head duel to an eight-model battle royale, then optionally add your own critique before revisions begin.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {result && status === "complete" && (
        <WinnerReveal run={result} show={showWinner} onDismiss={() => setShowWinner(false)} />
      )}
    </div>
  );
}
