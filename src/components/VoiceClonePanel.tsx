"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface VoiceClonePanelProps {
  refAudio: string;
  refText: string;
  onChangeRefAudio: (b64: string) => void;
  onChangeRefText: (text: string) => void;
  modelId: string;
}

const ACCEPTED_TYPES = ["audio/wav", "audio/mpeg", "audio/flac", "audio/mp4", "audio/ogg", "audio/x-wav", "audio/x-flac"];
const ACCEPTED_EXTENSIONS = ".wav,.mp3,.flac,.m4a,.ogg";
const MIN_DURATION = 10;
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const STORAGE_PREFIX = "tts_ref_audio_";

function readStoredMeta(modelId: string): { fileName: string; fileSize: number; duration: number } {
  try {
    const stored = sessionStorage.getItem(STORAGE_PREFIX + modelId);
    if (stored) {
      const data = JSON.parse(stored);
      return {
        fileName: data.fileName || "",
        fileSize: data.fileSize || 0,
        duration: data.duration || 0,
      };
    }
  } catch {
  }
  return { fileName: "", fileSize: 0, duration: 0 };
}

export default function VoiceClonePanel({
  refAudio,
  refText,
  onChangeRefAudio,
  onChangeRefText,
  modelId,
}: VoiceClonePanelProps) {
  const [open, setOpen] = useState<boolean>(() => !!readStoredMeta(modelId).fileName);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [meta, setMeta] = useState(() => readStoredMeta(modelId));
  const [error, setError] = useState("");

  useEffect(() => {
    if (refAudio) {
      sessionStorage.setItem(STORAGE_PREFIX + modelId, JSON.stringify({
        refAudio, refText, fileName: meta.fileName, fileSize: meta.fileSize, duration: meta.duration,
      }));
    }
  }, [refAudio, refText, meta.fileName, meta.fileSize, meta.duration, modelId]);

  const processFile = useCallback((file: File) => {
    setMeta({ fileName: "", fileSize: 0, duration: 0 });
    setError("");

    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(wav|mp3|flac|m4a|ogg)$/i)) {
      setError("Unsupported format. Use WAV, MP3, FLAC, M4A, or OGG.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("File too large. Maximum 10 MB.");
      return;
    }

    const newMeta = { fileName: file.name, fileSize: file.size, duration: 0 };
    setMeta(newMeta);

    const reader = new FileReader();
    reader.onload = (e) => {
      const b64 = (e.target?.result as string).split(",")[1] || "";
      const url = URL.createObjectURL(file);
      const tempAudio = new Audio(url);
      tempAudio.onloadedmetadata = () => {
        const dur = tempAudio.duration;
        URL.revokeObjectURL(url);
        setMeta((prev) => ({ ...prev, duration: dur }));
        if (dur < MIN_DURATION) {
          setError(`Reference audio must be at least ${MIN_DURATION} seconds (got ${dur.toFixed(1)}s).`);
          return;
        }
        onChangeRefAudio(b64);
      };
      tempAudio.onerror = () => {
        URL.revokeObjectURL(url);
        onChangeRefAudio(b64);
      };
    };
    reader.readAsDataURL(file);
  }, [onChangeRefAudio]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  const handleBrowse = useCallback(() => inputRef.current?.click(), []);
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  }, [processFile]);

  const handleClear = useCallback(() => {
    onChangeRefAudio("");
    onChangeRefText("");
    setMeta({ fileName: "", fileSize: 0, duration: 0 });
    setError("");
    setOpen(false);
    sessionStorage.removeItem(STORAGE_PREFIX + modelId);
  }, [onChangeRefAudio, onChangeRefText, modelId]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors duration-200 cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          Voice Cloning
          {refAudio && <span className="text-emerald-400">&#9679;</span>}
        </span>
        <svg className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!refAudio ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer ${
                dragOver ? "border-slate-400 bg-slate-800/50" : "border-slate-700 hover:border-slate-500 bg-slate-900/30"
              }`}
              onClick={handleBrowse}
            >
              <svg className="w-6 h-6 mx-auto mb-2 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-xs text-slate-400 mb-1">Drop reference audio or click to browse</p>
              <p className="text-[10px] text-slate-600">WAV, MP3, FLAC, M4A, OGG &middot; Max 10 MB &middot; Min 10 seconds</p>
              <input ref={inputRef} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={handleFileChange} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-300 truncate">{meta.fileName}</p>
                    <p className="text-[10px] text-slate-500">{formatSize(meta.fileSize)} &middot; {meta.duration.toFixed(1)}s</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <audio ref={audioRef} src={`data:audio/wav;base64,${refAudio}`} className="hidden" />
                  <button
                    type="button"
                    onClick={() => { const a = audioRef.current; if (a) { if (a.paused) { a.play().catch(() => {}); } else { a.pause(); } } }}
                    className="flex items-center justify-center w-7 h-7 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors cursor-pointer"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="flex items-center justify-center w-7 h-7 rounded bg-slate-700 text-slate-400 hover:text-red-400 hover:bg-slate-600 transition-colors cursor-pointer"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">Reference text (optional)</label>
                <input
                  type="text"
                  value={refText}
                  onChange={(e) => onChangeRefText(e.target.value)}
                  placeholder="Transcription of the reference audio — auto-transcribed if empty"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all"
                  dir="auto"
                />
              </div>

              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3">
                <p className="text-[10px] font-mono text-slate-500 mb-1.5">Tips for best cloning</p>
                <ul className="text-[10px] text-slate-500 space-y-0.5 list-disc list-inside">
                  <li>Use 10+ seconds of clear audio with a single speaker</li>
                  <li>WAV format at 24kHz+ sample rate preferred</li>
                  <li>No background noise, music, or other speakers</li>
                  <li>Speaking style should match your desired output</li>
                  <li>For Persian TTS, a Persian reference clip gives the most natural accent</li>
                </ul>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg p-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
