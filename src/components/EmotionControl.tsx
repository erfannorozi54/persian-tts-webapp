"use client";

import { useState } from "react";

interface EmotionControlProps {
  exaggeration: number;
  cfgWeight: number;
  speed: number;
  onChangeExaggeration: (val: number) => void;
  onChangeCfgWeight: (val: number) => void;
  onChangeSpeed: (val: number) => void;
  hasEmotionControl: boolean;
  hasSpeedControl: boolean;
}

const EXAGGERATION_PRESETS = [
  { label: "Neutral", value: 0.5 },
  { label: "Expressive", value: 0.7 },
  { label: "Dramatic", value: 1.0 },
];

export default function EmotionControl({
  exaggeration,
  cfgWeight,
  speed,
  onChangeExaggeration,
  onChangeCfgWeight,
  onChangeSpeed,
  hasEmotionControl,
  hasSpeedControl,
}: EmotionControlProps) {
  const [open, setOpen] = useState(false);

  if (!hasEmotionControl && !hasSpeedControl) return null;

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors duration-200 cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
          </svg>
          Style &amp; Emotion
          {(exaggeration !== 0.5 || cfgWeight !== 0.5 || speed !== 1.0) && (
            <span className="text-amber-400">&#9679;</span>
          )}
        </span>
        <svg className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {hasEmotionControl && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-mono text-slate-500">Exaggeration</label>
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">{exaggeration.toFixed(2)}</span>
                </div>
                <div className="relative">
                  <input
                    type="range"
                    min={0.25}
                    max={2.0}
                    step={0.05}
                    value={exaggeration}
                    onChange={(e) => onChangeExaggeration(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-slate-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-300 [&::-webkit-slider-thumb]:shadow-sm"
                  />
                  <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                    <span>Monotone</span>
                    <span>Neutral</span>
                    <span>Expressive</span>
                    <span>Dramatic</span>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {EXAGGERATION_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => onChangeExaggeration(p.value)}
                      className={`px-2 py-1 text-[10px] font-mono rounded border transition-all duration-150 cursor-pointer ${
                        Math.abs(exaggeration - p.value) < 0.01
                          ? "border-slate-500 bg-slate-700/50 text-slate-300"
                          : "border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-400"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-mono text-slate-500">CFG Weight</label>
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">{cfgWeight.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.0}
                  step={0.05}
                  value={cfgWeight}
                  onChange={(e) => onChangeCfgWeight(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-slate-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-300 [&::-webkit-slider-thumb]:shadow-sm"
                />
                <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                  <span>Loose</span>
                  <span>Default</span>
                  <span>Tight</span>
                </div>
                <p className="text-[9px] text-slate-600 mt-1 leading-relaxed">
                  Style adherence. Lower values = slower, more deliberate pacing. Higher = closer to reference.
                </p>
              </div>
            </>
          )}

          {hasSpeedControl && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-mono text-slate-500">Speed</label>
                <span className="text-[10px] font-mono text-slate-400 tabular-nums">{speed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={speed}
                onChange={(e) => onChangeSpeed(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-slate-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-300 [&::-webkit-slider-thumb]:shadow-sm"
              />
              <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                <span>0.5x</span>
                <span>1.0x</span>
                <span>2.0x</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
