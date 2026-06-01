# Voice Cloning + Emotion Control — Implementation Plan

## Models & Capabilities

| Model | Voice Cloning | Emotion Params | Speed Ctrl | Status |
|---|---|---|---|---|
| `chatterbox-persian` | ✓ `audio_prompt_path` | `exaggeration` (0.25-2.0), `cfg` (0-1) | ✗ | ✅ Phase 1 |
| `omnivoice` | ✓ `ref_audio` + `ref_text` | ✗ | ✓ `speed` | ✅ Phase 1 |
| `ims-toucan` | ✗ (complex, defer) | ✗ | ✗ | ❌ Dropped |

## User Decisions

| Question | Decision |
|---|---|
| Min reference audio duration | **10 seconds** |
| IMS Toucan voice cloning | **Defer** — ignore cloning for this model |
| Model mismatch handling | **Hide panels per model** — controls disappear on incompatible model |
| Persist across model switches | **Yes, sessionStorage** — keyed by modelId |

## File Change List

| # | File | Action |
|---|---|---|
| 1 | `src/types/index.ts` | Add `refAudio`, `refText`, `exaggeration`, `cfgWeight`, `speed` to `SynthesizeRequest` |
| 2 | `src/lib/chatterbox_wrapper.py` | Add refAudio → temp WAV → audio_prompt_path; add exaggeration, cfg params |
| 3 | `src/lib/tts.py` (omnivoice) | Add refAudio → temp WAV → ref_audio; add refText, speed params |
| 4 | `src/lib/models.ts` | Add `speed-control` capability to omnivoice |
| 5 | `src/components/VoiceClonePanel.tsx` | **New** — drop zone, upload, duration check, player, refText input, tips |
| 6 | `src/components/EmotionControl.tsx` | **New** — sliders: exaggeration, cfg weight, speed |
| 7 | `src/components/ModelCard.tsx` | Add SVG capability badges (microphone, face-smile, bolt) |
| 8 | `src/app/page.tsx` | Wire state, sessionStorage, conditional panels, API params |

## Implementation Order

1. Types → 2. Chatterbox wrapper → 3. OmniVoice handler → 4. models.ts tag
5. VoiceClonePanel → 6. EmotionControl → 7. ModelCard badges → 8. page.tsx wiring
9. `npm run build` + `npm run lint`

## Design Tokens (consistent with existing app)

- Colors: slate-based dark theme (existing), badges use accent borders
- Typography: existing font-mono + vazirmatn for Persian
- No emoji in code — use Heroicons SVG for capability badges
- All clickable elements: `cursor-pointer`, 150-300ms transitions

## Session Storage Strategy

```
Key: "tts_ref_audio_<modelId>"
Value: JSON { refAudio: base64, refText: string }
```

- Save on upload, restore on model switch-back
- Clear when model switches to non-cloning model
- Tab lifetime only (sessionStorage)
