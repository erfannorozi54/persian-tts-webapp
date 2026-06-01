"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TextEditor from "@/components/TextEditor";
import ModelCard from "@/components/ModelCard";
import AudioPlayer from "@/components/AudioPlayer";
import VoiceClonePanel from "@/components/VoiceClonePanel";
import EmotionControl from "@/components/EmotionControl";
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
  const [refAudio, setRefAudio] = useState("");
  const [refText, setRefText] = useState("");
  const [exaggeration, setExaggeration] = useState(0.5);
  const [cfgWeight, setCfgWeight] = useState(0.5);
  const [speed, setSpeed] = useState(1.0);

  const selectedModelData = models.find((m) => m.id === selectedModel);
  const hasVoiceCloning = selectedModelData?.capabilities.includes("voice-cloning") ?? false;
  const hasEmotionControl = selectedModelData?.capabilities.includes("emotion-control") ?? false;
  const hasSpeedControl = selectedModelData?.capabilities.includes("speed-control") ?? false;

  const STORAGE_PREFIX = "tts_ref_audio_";

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then(setModels)
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_PREFIX + selectedModel);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.refAudio) {
          setRefAudio(data.refAudio);
          setRefText(data.refText || "");
        }
      }
    } catch {
    }
  }, [selectedModel]);

  const handleModelSelect = (id: string) => {
    const nextModel = models.find((m) => m.id === id);
    if (!nextModel?.capabilities.includes("voice-cloning")) {
      setRefAudio("");
      setRefText("");
    }
    if (!nextModel?.capabilities.includes("emotion-control")) {
      setExaggeration(0.5);
      setCfgWeight(0.5);
    }
    if (!nextModel?.capabilities.includes("speed-control")) {
      setSpeed(1.0);
    }
    setSelectedModel(id);
  };

  const handleLogout = useCallback(async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }, []);

  const synthesize = useCallback(async () => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = { text, modelId: selectedModel };
      if (refAudio) body.refAudio = refAudio;
      if (refText) body.refText = refText;
      if (exaggeration !== 0.5) body.exaggeration = exaggeration;
      if (cfgWeight !== 0.5) body.cfgWeight = cfgWeight;
      if (speed !== 1.0) body.speed = speed;

      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
  }, [text, selectedModel, refAudio, refText, exaggeration, cfgWeight, speed]);

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

          {hasVoiceCloning && (
            <VoiceClonePanel
              key={selectedModel}
              refAudio={refAudio}
              refText={refText}
              onChangeRefAudio={setRefAudio}
              onChangeRefText={setRefText}
              modelId={selectedModel}
            />
          )}

          <EmotionControl
            exaggeration={exaggeration}
            cfgWeight={cfgWeight}
            speed={speed}
            onChangeExaggeration={setExaggeration}
            onChangeCfgWeight={setCfgWeight}
            onChangeSpeed={setSpeed}
            hasEmotionControl={hasEmotionControl}
            hasSpeedControl={hasSpeedControl}
          />

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
