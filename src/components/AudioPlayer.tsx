"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface AudioPlayerProps {
  /** Base64-encoded WAV data URI prefix (without data:application/wav;base64,) */
  audioBase64: string;
  /** Audio format string */
  format: string;
  /** Estimated duration in seconds */
  duration?: number;
  /** Label displayed above the player */
  label?: string;
}

export default function AudioPlayer({
  audioBase64,
  format,
  duration,
  label,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const downloadName = `tts-output.${format}`;

  const src = `data:audio/${format};base64,${audioBase64}`;

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.addEventListener("ended", () => setIsPlaying(false));
    return () => a.removeEventListener("ended", () => setIsPlaying(false));
  }, []);

  return (
    <div className="bg-card rounded-lg border border-slate-700 p-4">
      {/* Label */}
      {label && (
        <span className="text-xs text-slate-400 mb-3 block">{label}</span>
      )}

      {/* Waveform-like progress bar */}
      <div className="relative mb-3">
        <div className="w-full h-2 bg-slate-800 rounded overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-slate-500 to-slate-600 transition-all duration-100 ease-linear rounded"
            style={{
              width: duration
                ? `${(currentTime / duration) * 100}%`
                : "0%",
            }}
          />
        </div>

        {/* Time display */}
        <span className="mt-1 text-[10px] text-slate-600 font-mono block">
          {currentTime.toFixed(2)}s
          {duration ? ` / ${duration.toFixed(2)}s` : ""}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Play/Pause button */}
        <button
          type="button"
          className="flex items-center justify-center w-8 h-8 rounded bg-slate-500 text-slate-900 hover:bg-slate-400 active:scale-95 transition-all duration-150 cursor-pointer"
          onClick={() => {
            if (audioRef.current) {
              if (isPlaying) {
                audioRef.current.pause();
              } else {
                audioRef.current.play().catch(() => {});
              }
              setIsPlaying(!isPlaying);
            }
          }}
        >
          {isPlaying ? (
            <svg
              className="w-3 h-3"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg
              className="w-3 h-3"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Download button */}
        <a
          className="flex items-center justify-center w-8 h-8 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-200 transition-all duration-150 cursor-pointer"
          href={src}
          download={downloadName}
          aria-label="Download audio file"
>
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 13v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6M12 15V3m0 0l4-4m-4 4L8 3"
            />
          </svg>
        </a>

        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            setIsPlaying(false);
          }}
          className="hidden"
        />
      </div>
    </div>
  );
}
