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

      {/* Capabilities */}
      <div className="mt-3 flex flex-wrap gap-1">
        {model.capabilities.slice(0, 3).map((cap) => (
          <span
            key={cap}
            className="px-1.5 py-0.5 text-[10px] bg-slate-800 text-slate-400 rounded"
          >
            {cap}
          </span>
        ))}
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
