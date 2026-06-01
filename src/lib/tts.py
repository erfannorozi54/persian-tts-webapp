#!/usr/bin/env python3
"""TTS inference entrypoint. Called as subprocess from Next.js API routes.

Input (stdin): JSON { modelId, text, modelPath, outputDir, refAudio?, device? }
Output (stdout): JSON { audioBase64, format, duration, error? }
"""

import sys
import os
import json
import base64
import io
import wave
import contextlib
import numpy as np

def encode_wav_base64(audio_np: np.ndarray, sample_rate: int) -> tuple[str, float]:
    """Convert numpy audio array to base64 WAV and return (base64, duration)."""
    if audio_np.dtype != np.float32:
        audio_np = audio_np.astype(np.float32)

    peak = np.max(np.abs(audio_np))
    if peak > 1.0:
        audio_np = audio_np / peak

    pcm = (audio_np * 32767).astype(np.int16).tobytes()
    duration = len(audio_np) / sample_rate

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)

    return base64.b64encode(buf.getvalue()).decode("utf-8"), duration


def select_device(requested: str) -> str:
    if requested == "cpu":
        return "cpu"
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


# ---------------------------------------------------------------------------
# facebook/mms-tts-fas  (Persian-specific lightweight TTS)
# ---------------------------------------------------------------------------
def synthesize_mms_tts_fas(payload: dict) -> dict:
    device = select_device(payload.get("device", "auto"))
    model_path = payload["modelPath"]

    from transformers import VitsModel, AutoTokenizer

    model = VitsModel.from_pretrained(model_path).to(device)
    tokenizer = AutoTokenizer.from_pretrained(model_path)

    inputs = tokenizer(payload["text"], return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}

    import torch
    with torch.no_grad():
        output = model(**inputs).waveform

    audio_np = output.squeeze().cpu().float().numpy()
    sample_rate = model.config.sampling_rate

    b64, dur = encode_wav_base64(audio_np, sample_rate)
    return {"audioBase64": b64, "format": "wav", "duration": dur}


# ---------------------------------------------------------------------------
# k2-fsa/OmniVoice
# ---------------------------------------------------------------------------
def synthesize_omnivoice(payload: dict) -> dict:
    device = select_device(payload.get("device", "auto"))

    from omnivoice import OmniVoice
    import torch

    model = OmniVoice.from_pretrained(
        payload["modelPath"],
        device_map=device,
        dtype=torch.float16 if device == "cuda" else torch.float32,
    )

    audios = model.generate(
        text=payload["text"],
    )

    audio_np = audios[0].astype(np.float32)
    b64, dur = encode_wav_base64(audio_np, 24000)
    return {"audioBase64": b64, "format": "wav", "duration": dur}


# ---------------------------------------------------------------------------
# Piper TTS  (ONNX-based, Persian voice)
# ---------------------------------------------------------------------------
PIPER_MODEL_PATHS = {
    "piper-fa-amir": lambda mp: os.path.join(mp, "fa/fa_IR/amir/medium/fa_IR-amir-medium.onnx"),
    "piper-fa-gyro": lambda mp: os.path.join(mp, "fa/fa_IR/gyro/medium/fa_IR-gyro-medium.onnx"),
    "mana-piper": lambda mp: os.path.join(mp, "fa_IR-mana-medium.onnx"),
    "pertts-amir": lambda mp: os.path.join(mp, "farsi/amir/epoch=5261-step=2455712.onnx"),
    "pertts-ganji": lambda mp: os.path.join(mp, "farsi/ganji/epoch=5719-step=2609600-ganji.onnx"),
    "pertts-ganji-adabi": lambda mp: os.path.join(mp, "farsi/ganji-adabi/epoch=6363-step=2694608-ganji-adabi.onnx"),
}


def synthesize_piper(payload: dict) -> dict:
    model_id = payload["modelId"]
    model_path = payload["modelPath"]

    path_fn = PIPER_MODEL_PATHS.get(model_id)
    if path_fn is None:
        return {"error": f"Unknown piper model: {model_id}"}
    onnx_path = path_fn(model_path)

    if not os.path.isfile(onnx_path):
        return {"error": f"Piper model not found at {onnx_path}"}

    import piper

    voice = piper.PiperVoice.load(onnx_path, use_cuda=False)
    chunks = list(voice.synthesize(payload["text"]))
    if not chunks:
        return {"error": "Piper produced no audio output"}
    audio_parts = [c.audio_float_array for c in chunks]
    import numpy as np
    audio_np = np.concatenate(audio_parts)

    b64, dur = encode_wav_base64(audio_np, chunks[0].sample_rate)
    return {"audioBase64": b64, "format": "wav", "duration": dur}


# ---------------------------------------------------------------------------
# IMS-Toucan (FastSpeech2-based, 7000+ languages including Persian)
# ---------------------------------------------------------------------------
def synthesize_toucantts(payload: dict) -> dict:
    import sys as _sys
    toucan_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "third_party", "IMS-Toucan")
    if os.path.isdir(toucan_path) and toucan_path not in _sys.path:
        _sys.path.insert(0, os.path.abspath(toucan_path))

    model_path = payload["modelPath"]

    os.environ.setdefault("PHONEMIZER_ESPEAK_LIBRARY", "/usr/lib/x86_64-linux-gnu/libespeak-ng.so.1")

    import Utility.storage_config as storage_config
    storage_config.MODEL_DIR = os.path.abspath(model_path)

    from InferenceInterfaces.ControllableInterface import ControllableInterface

    device = select_device(payload.get("device", "auto"))
    import torch
    cuda_available = torch.cuda.is_available()
    gpu_id = 0 if device == "cuda" and cuda_available else "cpu"

    # Redirect IMS-Toucan's noisy stdout prints to stderr
    import io, contextlib
    _stdout_buf = io.StringIO()
    with contextlib.redirect_stdout(_stdout_buf):
        tts = ControllableInterface(
            gpu_id=gpu_id,
            available_artificial_voices=5,
            tts_model_path=os.path.join(model_path, "ToucanTTS.pt"),
            vocoder_model_path=os.path.join(model_path, "Vocoder.pt"),
            embedding_gan_path=os.path.join(model_path, "embedding_gan.pt"),
        )
        sr, audio_np, _ = tts.read(
            payload["text"],
            None,
            "pes",
            "pes",
            5,
            0.5,
            1.0,
            1.0,
            1.0,
            1.0,
            0.0,
            0.0,
            0.0,
            0.0,
            0.0,
            0.0,
            -24.0,
        )
    b64, dur = encode_wav_base64(audio_np, sr)
    return {"audioBase64": b64, "format": "wav", "duration": dur}


# ---------------------------------------------------------------------------
# Kamtera VITS (Coqui TTS format — called via .venv-tts subprocess)
# ---------------------------------------------------------------------------
def synthesize_kamtera_vits(payload: dict) -> dict:
    wrapper = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vits_wrapper.py")
    tts_venv_python = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        ".venv-tts", "bin", "python3",
    )
    if not os.path.isfile(tts_venv_python):
        return {"error": f"TTS venv not found at {tts_venv_python}. Create with: python3.10 -m venv .venv-tts && .venv-tts/bin/pip install TTS"}

    import subprocess as _sp, json as _json

    proc = _sp.run(
        [tts_venv_python, wrapper],
        input=_json.dumps(payload),
        capture_output=True,
        text=True,
        timeout=120,
    )
    if proc.returncode != 0 or not proc.stdout.strip():
        err = proc.stderr.strip() or f"Process exited with code {proc.returncode}"
        return {"error": f"VITS inference failed: {err}"}
    try:
        return _json.loads(proc.stdout)
    except _json.JSONDecodeError:
        return {"error": f"Invalid JSON from VITS wrapper: {proc.stdout[:200]}"}


# ---------------------------------------------------------------------------
# Chatterbox Multilingual + Persian Fine-tune (Thomcles/Chatterbox-TTS-Persian-Farsi)
# Called via .venv-chatterbox subprocess to avoid dependency conflicts.
# ---------------------------------------------------------------------------
def synthesize_chatterbox_persian(payload: dict) -> dict:
    wrapper = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chatterbox_wrapper.py")
    chatterbox_venv_python = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        ".venv-chatterbox", "bin", "python3",
    )
    if not os.path.isfile(chatterbox_venv_python):
        return {"error": f"Chatterbox venv not found at {chatterbox_venv_python}. Create with: python3.11 -m venv .venv-chatterbox && .venv-chatterbox/bin/pip install chatterbox-tts"}

    import subprocess as _sp, json as _json

    proc = _sp.run(
        [chatterbox_venv_python, wrapper],
        input=_json.dumps(payload),
        capture_output=True,
        text=True,
        timeout=300,
    )
    if proc.returncode != 0 or not proc.stdout.strip():
        err = proc.stderr.strip() or f"Process exited with code {proc.returncode}"
        return {"error": f"Chatterbox inference failed: {err}"}
    try:
        return _json.loads(proc.stdout)
    except _json.JSONDecodeError:
        return {"error": f"Invalid JSON from Chatterbox wrapper: {proc.stdout[:200]}"}


# ---------------------------------------------------------------------------
# Main entrypoint
# ---------------------------------------------------------------------------
HANDLERS = {
    "mms-tts-fas": synthesize_mms_tts_fas,
    "omnivoice": synthesize_omnivoice,
    "piper-fa-amir": synthesize_piper,
    "piper-fa-gyro": synthesize_piper,
    "mana-piper": synthesize_piper,
    "pertts-amir": synthesize_piper,
    "pertts-ganji": synthesize_piper,
    "pertts-ganji-adabi": synthesize_piper,
    "ims-toucan": synthesize_toucantts,
    "kamtera-male-vits": synthesize_kamtera_vits,
    "kamtera-female-vits": synthesize_kamtera_vits,
    "chatterbox-persian": synthesize_chatterbox_persian,
}


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON input"}))
        sys.exit(1)

    model_id = payload.get("modelId")
    if not model_id or model_id not in HANDLERS:
        print(json.dumps({"error": f"Unknown or missing modelId: {model_id}"}))
        sys.exit(1)

    if not payload.get("text"):
        print(json.dumps({"error": "Missing text field"}))
        sys.exit(1)

    try:
        result = HANDLERS[model_id](payload)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": f"Inference failed: {str(e)}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
