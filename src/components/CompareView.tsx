"use client";

import AudioPlayer from "./AudioPlayer";
import { useCallback, useState } from "react";
import { CompareResult } from "@/types";

interface CompareViewProps {
  modelIds: string[];
  modelName: (id: string) => string;
}

export default function CompareView({ modelIds, modelName }: CompareViewProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, CompareResult>>({});

  const synthesizeOne = useCallback(
    async (modelId: string) => {
      setLoading((prev) => ({ ...prev, [modelId]: true }));
      try {
        const res = await fetch("/api/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, modelId }),
        });
        const data = await res.json();
        if (data.audioBase64) {
          setResults((prev) => ({
            ...prev,
            [modelId]: {
              modelId,
              audioBase64: data.audioBase64,
              format: data.format,
              duration: data.duration,
            },
          }));
        } else if (data.error) {
          setResults((prev) => ({
            ...prev,
            [modelId]: {
              modelId,
              audioBase64: "",
              format: "wav",
              error: data.error,
            },
          }));
        }
      } finally {
        setLoading((prev) => ({ ...prev, [modelId]: false }));
      }
    },
    [text]
  );

  const synthesizeAll = useCallback(() => {
    modelIds.forEach((id) => synthesizeOne(id));
  }, [modelIds, synthesizeOne]);

  return (
    <div className="space-y-6">
      {/* Text input */}
      <textarea
        dir="rtl"
        className="w-full min-h-[150px] resize-y bg-card border border-slate-700 rounded-lg p-4 text-right font-vazirmatn text-sm leading-relaxed text-slate-400 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="متن را بنویسید..."
        maxLength={5000}
      />

      {/* Bulk synthesize button */}
      <button
        type="button"
        className="inline-flex items-center px-6 py-3 rounded-lg bg-slate-500 text-slate-900 font-semibold text-sm hover:bg-slate-400 active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={synthesizeAll}
        disabled={!text.trim() || modelIds.some((id) => loading[id])}
      >
        Synthesize All Models
      </button>

      {/* Side-by-side results */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modelIds.map((modelId) => (
          <div key={modelId} className="space-y-2">
            <div className="text-xs text-slate-400 font-mono border-b border-slate-700 pb-2">
              {modelName(modelId)}
            </div>

            {/* Single model synthesize button */}
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 rounded-md bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-all duration-150 cursor-pointer disabled:opacity-50"
              onClick={() => synthesizeOne(modelId)}
              disabled={!text.trim() || loading[modelId]}
            >
              {loading[modelId] ? "Synthesizing..." : "Synthesize"}
            </button>

            {/* Result */}
            {results[modelId] && (
              <div className="mt-2">
                {results[modelId].error ? (
                  <p className="text-xs text-red-500">{results[modelId].error}</p>
                ) : (
                  <AudioPlayer
                    audioBase64={results[modelId].audioBase64}
                    format={results[modelId].format}
                    duration={results[modelId].duration}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
