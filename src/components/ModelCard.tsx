import { TTSModel } from "@/types";

interface ModelCardProps {
  /** Model data */
  model: TTSModel;
  /** Is this model currently selected? */
  isSelected: boolean;
  /** Whether downloads are complete */
  isDownloaded: boolean;
  /** On change handler */
  onSelect: (id: string) => void;
}

export default function ModelCard({
  model,
  isSelected,
  isDownloaded,
  onSelect,
}: ModelCardProps) {
  return (
    <button
      type="button"
      className={`flex flex-col items-start w-full rounded-lg p-4 border-2 transition-all duration-200 ease-in-out text-left cursor-pointer ${
        isSelected
          ? "border-slate-500 bg-slate-500/10 shadow-lg shadow-slate-500/20"
          : "border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:shadow-md"
      }`}
      onClick={() => onSelect(model.id)}
    >
      {/* Model ID badge */}
      <span
        className={`inline-block px-2 py-0.5 text-[10px] font-mono rounded ${
          isSelected ? "bg-slate-500 text-slate-900" : "bg-slate-800 text-slate-400"
        }`}
      >
        {model.id}
      </span>

      {/* Model name */}
      <span className="mt-2.5 text-sm font-semibold text-slate-100">
        {model.name}
      </span>

      {/* Description */}
      <span className="mt-1.5 text-xs leading-relaxed text-slate-500 line-clamp-2">
        {model.description}
      </span>

      {/* Capability badges */}
      <div className="mt-3 flex flex-wrap gap-1">
        {model.capabilities.includes("voice-cloning") && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-amber-900/30 text-amber-400 border border-amber-800/50 rounded">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Clone
          </span>
        )}
        {model.capabilities.includes("emotion-control") && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-pink-900/30 text-pink-400 border border-pink-800/50 rounded">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
            </svg>
            Emotion
          </span>
        )}
        {model.capabilities.includes("speed-control") && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-cyan-900/30 text-cyan-400 border border-cyan-800/50 rounded">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            Speed
          </span>
        )}
        {model.capabilities.slice(0, 3).map((cap) => {
          if (["voice-cloning", "emotion-control", "speed-control"].includes(cap)) return null;
          return (
            <span
              key={cap}
              className="px-1.5 py-0.5 text-[10px] bg-slate-800 text-slate-400 rounded"
            >
              {cap}
            </span>
          );
        })}
        {model.capabilities.length > 3 && (
          <span className="px-1.5 py-0.5 text-[10px] bg-slate-800 text-slate-400 rounded">
            +{model.capabilities.length - 3}
          </span>
        )}
      </div>

      {/* VRAM + status */}
      <div className="mt-auto pt-2.5 flex items-center justify-between w-full">
        <span className="text-[10px] text-slate-600 font-mono">
          {model.vramRequired}GB VRAM
        </span>
        <span
          className={`text-[10px] font-mono ${
            isDownloaded ? "text-slate-500" : "text-slate-600"
          }`}
        >
          {isDownloaded ? "ready" : "not downloaded"}
        </span>
      </div>
    </button>
  );
}
