# Implementation Plan — Persian TTS Web App

## Overview
Build a Next.js app that serves three TTS models via Python subprocess, with lazy download and CPU fallback.

## Phase 1: Project Scaffolding
- Initialize Next.js 14+ with TypeScript, TailwindCSS, Framer Motion
- Create target directory structure:
  ```
  src/
  ├── app/
  │   ├── page.tsx
  │   ├── compare/page.tsx
  │   └── api/
  │       ├── synthesize/route.ts
  │       └── models/route.ts
  ├── components/
  │   ├── TextEditor.tsx
  │   ├── ModelCard.tsx
  │   ├── AudioPlayer.tsx
  │   └── CompareView.tsx
  ├── lib/
  │   ├── tts.py
  │   └── models.ts
  └── types/
      └── index.ts
  ```
- Add `framer-motion` to dependencies

## Phase 2: Environment Setup
- Create `requirements.txt` with all Python dependencies:
  - PyTorch + torchaudio (CPU wheels, GPU optional)
  - `transformers>=5.0` (for MOSS-TTS)
  - `fish-speech` (from fishaudio/fish-speech repo, for s2-pro)
  - `omnivoice` pip package (for OmniVoice)
  - `soundfile`, `numpy`
- Create `setup.sh` — creates venv, installs deps, runs model download

## Phase 3: Model Pre-download Script
- `scripts/download-models.py`:
  - Downloads `fishaudio/s2-pro` → `models/fishaudio-s2-pro/`
  - Downloads `OpenMOSS-Team/MOSS-TTS` → `models/moss-tts/`
  - Downloads `k2-fsa/OmniVoice` → `models/omnivoice/`
  - Uses `huggingface_hub.snapshot_download` with progress
  - Creates `.models-downloaded` marker file
  - ~25GB total download

## Phase 4: Python Inference Layer (`src/lib/tts.py`)
Accept JSON via stdin: `{ modelId, text, refAudio?, outputDir }`
Output: base64 WAV string to stdout

### Per-model pipelines:
1. **fishaudio/s2-pro** — 3-step CLI flow:
   - VQ codec: `fish_speech/models/dac/inference.py` → extract VQ tokens from ref audio
   - Slow AR: `fish_speech/models/text2semantic/inference.py` → semantic tokens from text
   - Fast AR: `fish_speech/models/dac/inference.py` → decode semantic tokens → WAV
   - Requires fish-speech repo dependencies

2. **OpenMOSS-Team/MOSS-TTS** — transformers pipeline:
   - `AutoProcessor.from_pretrained()` + `AutoModel.from_pretrained()`
   - Build conversation → processor → model.generate() → decode → audio tensor → WAV
   - 8B MossTTSDelay (production), 1.7B MossTTSLocal (lightweight alt)

3. **k2-fsa/OmniVoice** — pip package API:
   - `OmniVoice.from_pretrained()` 
   - `model.generate(text, ref_audio?, instruct?)` → numpy array → WAV

### CPU fallback:
- Detect CUDA availability at runtime
- If OOM or no GPU, device="cpu"
- Lazy load: models load on first call, cached in process

## Phase 5: Next.js API Routes
- `src/app/api/models/route.ts` (GET):
  - Returns model list with id, name, description, VRAM, language support, download status
- `src/app/api/synthesize/route.ts` (POST `{ text, modelId, refAudio? }`):
  - Spawns Python subprocess: `python src/lib/tts.py`
  - Passes JSON via stdin, reads base64 WAV from stdout
  - Returns `{ audioBase64, format: "wav" }`

## Phase 6: UI Components
- Follow `design-system/tts/MASTER.md` for all styling
- `TextEditor.tsx` — RTL Persian textarea, Vazirmatn font, dir="rtl"
- `ModelCard.tsx` — shows 3 models with capabilities, VRAM, language support
- `AudioPlayer.tsx` — playback controls, waveform visualization, download button
- `CompareView.tsx` — side-by-side model comparison layout

## Phase 7: Pages
- `src/app/page.tsx` — landing page with text editor, model selector, single synthesis
- `src/app/compare/page.tsx` — side-by-side comparison of all 3 models

## Phase 8: Testing
- Test each model independently via API endpoint
- Test CPU fallback behavior
- Test compare flow
- Test RTL rendering

## Critical Notes
- GPU: RTX 3060 Laptop 6GB VRAM — all 3 models will likely fall back to CPU
- Models download on setup (pre-download), not lazy
- No auth, no database, no caching, no queuing
- Audio format: base64-encoded WAV
- Python is subprocess, not imported directly
