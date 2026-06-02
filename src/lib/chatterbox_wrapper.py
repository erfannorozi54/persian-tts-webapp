#!/home/erfan/Projects/TTS/.venv-chatterbox/bin/python3
"""Chatterbox Persian inference wrapper. Only outputs JSON to stdout."""
import sys, os, json, base64, io, wave, tempfile
import numpy as np

venv_bin = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", ".venv-chatterbox", "bin")
os.environ['PATH'] = venv_bin + ':' + os.environ.get('PATH', '')

os.environ["http_proxy"] = "http://127.0.0.1:10809"
os.environ["https_proxy"] = "http://127.0.0.1:10809"
os.environ["HTTP_PROXY"] = "http://127.0.0.1:10809"
os.environ["HTTPS_PROXY"] = "http://127.0.0.1:10809"
os.environ.pop("ALL_PROXY", None)  # remove any SOCKS5 proxy that conflicts


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


def decode_base64_audio(b64_str: str) -> tuple[np.ndarray, int]:
    raw = base64.b64decode(b64_str)
    with wave.open(io.BytesIO(raw), "rb") as wf:
        nframes = wf.getnframes()
        sample_rate = wf.getframerate()
        pcm = wf.readframes(nframes)
    audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32767.0
    return audio, sample_rate


def main():
    raw = sys.stdin.read()
    _old_stdout = sys.stdout
    sys.stdout = sys.stderr

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON input"}), file=_old_stdout)
        sys.exit(1)

    model_path = payload.get("modelPath", "")
    text = payload.get("text", "")
    device_str = payload.get("device", "auto")
    ref_audio_b64 = payload.get("refAudio")
    exaggeration = payload.get("exaggeration")
    cfg_weight = payload.get("cfgWeight")

    if not text:
        print(json.dumps({"error": "Missing text field"}), file=_old_stdout)
        sys.exit(1)

    tmp_files = []

    try:
        import torch

        if device_str == "cpu":
            device = "cpu"
        else:
            device = "cuda" if torch.cuda.is_available() else "cpu"

        from chatterbox.mtl_tts import ChatterboxMultilingualTTS

        model = ChatterboxMultilingualTTS.from_pretrained(device=device)

        adapter_path = os.path.join(model_path, "t3_fa.safetensors")
        if os.path.isfile(adapter_path):
            from safetensors import safe_open
            t3_state = {}
            with safe_open(adapter_path, framework="pt", device="cpu") as f:
                for key in f.keys():
                    t3_state[key] = f.get_tensor(key)
            model.t3.load_state_dict(t3_state)
            model.t3.to(device).eval()

        gen_kwargs = {"language_id": None}

        if ref_audio_b64:
            audio_arr, sr = decode_base64_audio(ref_audio_b64)
            if len(audio_arr) / sr < 10.0:
                print(json.dumps({"error": "Reference audio must be at least 10 seconds"}), file=_old_stdout)
                sys.exit(1)
            fd, tmp_path = tempfile.mkstemp(suffix=".wav")
            os.close(fd)
            tmp_files.append(tmp_path)
            with wave.open(tmp_path, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(sr)
                wf.writeframes((audio_arr * 32767).astype(np.int16).tobytes())
            gen_kwargs["audio_prompt_path"] = tmp_path

        if exaggeration is not None:
            gen_kwargs["exaggeration"] = max(0.25, min(2.0, float(exaggeration)))

        if cfg_weight is not None:
            gen_kwargs["cfg"] = max(0.0, min(1.0, float(cfg_weight)))

        with torch.no_grad():
            wav = model.generate(text, **gen_kwargs)

        audio_np = wav.squeeze().cpu().float().numpy()

        sys.stdout = _old_stdout
        b64, dur = encode_wav_base64(audio_np, model.sr)
        print(json.dumps({"audioBase64": b64, "format": "wav", "duration": dur}))

    except Exception as e:
        sys.stdout = _old_stdout
        print(json.dumps({"error": f"Chatterbox inference failed: {str(e)}"}))
        sys.exit(1)
    finally:
        for p in tmp_files:
            try:
                os.remove(p)
            except OSError:
                pass


if __name__ == "__main__":
    main()
