"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TextEditor from "@/components/TextEditor";
import ModelCard from "@/components/ModelCard";
import AudioPlayer from "@/components/AudioPlayer";
import { TTSModel, SynthesizeResponse } from "@/types";

interface ModelWithStatus extends TTSModel {
  downloaded: boolean;
}

export default function Home() {
  const [text, setText] = useState("");
  const [selectedModel, setSelectedModel] = useState("ims-toucan");
  const [models, setModels] = useState<ModelWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, SynthesizeResponse>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then(setModels)
      .catch(() => {});
  }, []);

  const handleModelSelect = (id: string) => {
    setSelectedModel(id);
  };

  const handleLogout = useCallback(async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }, []);

  const synthesize = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, modelId: selectedModel }),
      });
      const data = await res.json();
      if (data.audioBase64) {
        setResults((prev) => ({ ...prev, [selectedModel]: data }));
        setErrors((prev) => {
          const next = { ...prev };
          delete next[selectedModel];
          return next;
        });
      } else if (data.error) {
        setErrors((prev) => ({ ...prev, [selectedModel]: data.error }));
      }
    } catch (e: unknown) {
      setErrors((prev) => ({
        ...prev,
        [selectedModel]: e instanceof Error ? e.message : "Synthesis failed",
      }));
    } finally {
      setLoading(false);
    }
  }, [text, selectedModel]);

  return (
    <motion.main
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 max-w-5xl mx-auto px-6 py-12 w-full"
    >
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono text-slate-100">
            Persian TTS
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Select a model, write your text, and synthesize speech.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs font-mono text-slate-400 hover:text-slate-100 border border-slate-700 hover:border-slate-500 rounded-md px-3 py-1.5 transition-colors duration-200 cursor-pointer"
        >
          Logout
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr,280px]">
        <section className="space-y-6">
          <TextEditor value={text} onChange={setText} />
          <button
            type="button"
            className="btn-primary"
            onClick={synthesize}
            disabled={!text.trim() || loading}
          >
            {loading ? "Synthesizing..." : "Synthesize"}
          </button>

          {errors[selectedModel] && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg p-3"
            >
              {errors[selectedModel]}
            </motion.div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500">
            Models
          </h2>
          {models.map((model) => (
            <div key={model.id} className="space-y-2">
              <ModelCard
                model={model}
                isSelected={model.id === selectedModel}
                isDownloaded={model.downloaded}
                onSelect={handleModelSelect}
              />
              {errors[model.id] && !results[model.id] && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg p-2">
                  {errors[model.id]}
                </p>
              )}
              <AnimatePresence>
                {results[model.id] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <AudioPlayer
                      audioBase64={results[model.id].audioBase64}
                      format={results[model.id].format}
                      duration={results[model.id].duration}
                      label={model.name}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </section>
      </div>
    </motion.main>
  );
}
