#!/home/erfan/Projects/TTS/.venv-tts/bin/python3
"""Kamtera VITS inference wrapper. Only outputs JSON to stdout."""
import sys, os, json, base64, io, wave
import numpy as np

venv_bin = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", ".venv-tts", "bin")
os.environ['PATH'] = venv_bin + ':' + os.environ.get('PATH', '')

# Redirect stdout to stderr during TTS operations to suppress stray prints
import contextlib


def encode_wav_base64(audio_np: np.ndarray, sample_rate: int) -> tuple[str, float]:
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


def main():
    raw = sys.stdin.read()
    _old_stdout = sys.stdout
    sys.stdout = sys.stderr  # redirect all TTS prints to stderr

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON input"}), file=_old_stdout)
        sys.exit(1)

    model_path = payload.get("modelPath", "")
    text = payload.get("text", "")

    if not text:
        print(json.dumps({"error": "Missing text field"}), file=_old_stdout)
        sys.exit(1)

    try:
        from TTS.tts.models.vits import Vits
        from TTS.tts.configs.vits_config import VitsConfig
        import torch

        config_path = os.path.join(model_path, "config.json")
        config = VitsConfig()
        config.load_json(config_path)

        device = "cuda" if torch.cuda.is_available() else "cpu"

        model = Vits.init_from_config(config, verbose=False)
        ckpt_files = [f for f in os.listdir(model_path) if f.endswith(".pth")]
        if not ckpt_files:
            print(json.dumps({"error": "No .pth checkpoint found in model directory"}), file=_old_stdout)
            sys.exit(1)
        model.load_checkpoint(config, os.path.join(model_path, ckpt_files[0]), eval=True)
        model.to(device)

        ids = model.tokenizer.text_to_ids(text)
        x = torch.tensor([ids], dtype=torch.long, device=device)
        x_lengths = torch.tensor([x.shape[1]], dtype=torch.long, device=device)
        outputs = model.inference(x, aux_input={"x_lengths": x_lengths})
        audio_np = outputs["model_outputs"].squeeze().cpu().float().numpy()
        sr = config.audio["sample_rate"]

        sys.stdout = _old_stdout
        b64, dur = encode_wav_base64(audio_np, sr)
        print(json.dumps({"audioBase64": b64, "format": "wav", "duration": dur}))

    except Exception as e:
        sys.stdout = _old_stdout
        print(json.dumps({"error": f"VITS inference failed: {str(e)}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
