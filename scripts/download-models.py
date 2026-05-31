"""Download all TTS models from HuggingFace Hub.
Uses requests with streaming + resume for reliability over slow connections."""

import sys
import os
import time
import shutil
from pathlib import Path

# Load HF_TOKEN from .env if present
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.isfile(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

import requests
from huggingface_hub import HfApi

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(REPO_DIR, "models")

MODEL_DOWNLOADS = [
    ("mms-tts-fas", "facebook/mms-tts-fas", "mms-tts-fas"),
    ("omnivoice", "k2-fsa/OmniVoice", "omnivoice"),
    # Piper Persian voices are downloaded separately via download_piper_voices()
]

# ToucanTTS files needed for inference (excluding large training-only artifacts)
TOUCANTTS_FILES = [
    "ToucanTTS.pt",
    "Vocoder.pt",
    "embedding_gan.pt",
    "iso_lookup.json",
    "iso_to_fullname.json",
    "iso_to_memberships.json",
    "supervised_languages.json",
]

PIPER_VOICES = [
    {
        "id": "piper-fa-amir",
        "name": "Piper Persian (Amir)",
        "local_dir": "piper-fa",
        "files": [
            "fa/fa_IR/amir/medium/fa_IR-amir-medium.onnx",
            "fa/fa_IR/amir/medium/fa_IR-amir-medium.onnx.json",
        ],
    },
    {
        "id": "piper-fa-gyro",
        "name": "Piper Persian (Gyro)",
        "local_dir": "piper-fa",
        "files": [
            "fa/fa_IR/gyro/medium/fa_IR-gyro-medium.onnx",
            "fa/fa_IR/gyro/medium/fa_IR-gyro-medium.onnx.json",
        ],
    },
]

TOKEN = os.getenv("HF_TOKEN")
HEADERS = {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}
CHUNK_SIZE = 8 * 1024 * 1024  # 8 MB

# HTTP proxy on port 10808
HTTP_PROXY = os.getenv("HTTP_PROXY") or os.getenv("http_proxy") or "http://127.0.0.1:10808"
HTTPS_PROXY = os.getenv("HTTPS_PROXY") or os.getenv("https_proxy") or HTTP_PROXY
PROXIES = {"http": HTTP_PROXY, "https": HTTPS_PROXY}


def get_file_list(hf_id: str) -> list[dict]:
    os.environ.setdefault("HTTP_PROXY", HTTP_PROXY)
    os.environ.setdefault("HTTPS_PROXY", HTTPS_PROXY)
    api = HfApi(token=TOKEN)
    model_info = api.model_info(hf_id, files_metadata=True)
    files = []
    for file in model_info.siblings:
        if file.rfilename in (".gitattributes", ".git"):
            continue
        sz = file.lfs.size if file.lfs else (file.size or 0)
        files.append({
            "path": file.rfilename,
            "size": sz,
        })
    files.sort(key=lambda f: f["size"])
    return files


def download_file(url: str, dest: str, total_size: int, label: str) -> None:
    """Download with resume support and progress."""
    os.makedirs(os.path.dirname(dest), exist_ok=True)

    if total_size == 0:
        # Small metadata file, just download
        with requests.get(url, headers=HEADERS, proxies=PROXIES, timeout=30) as r:
            if r.status_code == 200:
                with open(dest, "wb") as f:
                    f.write(r.content)
            else:
                print(f"  [FAIL] {label} HTTP {r.status_code}")
        return

    downloaded = 0
    mode = "wb"

    if os.path.isfile(dest):
        downloaded = os.path.getsize(dest)
        if downloaded < total_size:
            mode = "ab"
            print(f"  Resuming {label}: {downloaded}/{total_size} bytes")
        elif downloaded == total_size:
            print(f"  [SKIP] {label} already exists")
            return
        else:
            downloaded = 0
            mode = "wb"

    headers = dict(HEADERS)
    if downloaded > 0:
        headers["Range"] = f"bytes={downloaded}-"

    with requests.get(url, headers=headers, proxies=PROXIES, stream=True, timeout=(60, 120)) as r:
        if r.status_code in (200, 206):
            with open(dest, mode) as f:
                for chunk in r.iter_content(chunk_size=CHUNK_SIZE):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        pct = downloaded / total_size * 100 if total_size else 0
                        print(f"\r  {label}: {downloaded/1024**2:.1f}M/{total_size/1024**2:.1f}M ({pct:.0f}%)", end="", flush=True)
            print()
        else:
            print(f"  [FAIL] {label} HTTP {r.status_code}")


def download_model(model_id: str, hf_id: str, local_dir: str, files: list[dict]) -> None:
    local_path = Path(MODELS_DIR) / local_dir
    local_path.mkdir(parents=True, exist_ok=True)

    print(f"\n=== {model_id} ({hf_id}) ===")
    total = sum((f["size"] or 0) for f in files)
    print(f"  {len(files)} files, {total/1024**3:.1f} GB total")

    for f in files:
        url = f"https://huggingface.co/{hf_id}/resolve/main/{f['path']}"
        dest = str(local_path / f["path"])
        label = f["path"]
        sz = f["size"] or 0
        if sz > 1024**3:
            label += f" ({sz/1024**3:.1f} GB)"
        elif sz > 1024**2:
            label += f" ({sz/1024**2:.1f} MB)"

        attempt = 0
        while attempt < 3:
            try:
                download_file(url, dest, sz, label)
                break
            except Exception as e:
                attempt += 1
                if attempt < 3:
                    print(f"  [RETRY {attempt}] {label}: {e}")
                    time.sleep(2)
                else:
                    print(f"  [FAIL] {label}: {e}")

    actual = sum(f.stat().st_size for f in local_path.rglob("*") if f.is_file())
    print(f"  [OK] {model_id}: {actual/1024**3:.1f} GB downloaded")


def verify_model(local_path: Path, files: list[dict]) -> bool:
    """Check that every expected file exists with the correct size."""
    if not local_path.is_dir():
        return False
    for f in files:
        dest = local_path / f["path"]
        if not dest.is_file():
            print(f"  [MISSING] {f['path']}")
            return False
        expected = f["size"]
        actual = dest.stat().st_size
        if expected > 0 and actual != expected:
            print(f"  [PARTIAL] {f['path']}: {actual}/{expected} bytes")
            return False
    return True


PIPER_HF_ID = "rhasspy/piper-voices"


def get_piper_file_info(hf_path: str) -> dict | None:
    """Get file size for a specific file in the piper-voices repo."""
    try:
        api = HfApi(token=TOKEN)
        info = api.model_info(PIPER_HF_ID, files_metadata=True)
        for f in info.siblings:
            if f.rfilename == hf_path:
                sz = f.lfs.size if f.lfs else (f.size or 0)
                return {"path": hf_path, "size": sz}
    except Exception as e:
        print(f"  [WARN] Could not fetch metadata for {hf_path}: {e}")
    return {"path": hf_path, "size": 0}


def download_piper_voices() -> None:
    """Download specific Piper voice files (not the whole repo)."""
    print("\n=== Piper Persian Voices ===")
    for voice in PIPER_VOICES:
        local_path = Path(MODELS_DIR) / voice["local_dir"]
        local_path.mkdir(parents=True, exist_ok=True)

        all_ok = True
        for rel in voice["files"]:
            dest = local_path / rel
            # Check if file exists with correct size
            if dest.is_file() and dest.stat().st_size > 0:
                print(f"  [SKIP] {rel} — already exists")
                continue
            os.makedirs(dest.parent, exist_ok=True)
            info = get_piper_file_info(rel)
            url = f"https://huggingface.co/{PIPER_HF_ID}/resolve/main/{rel}"
            label = f"{voice['id']}: {rel}"
            attempt = 0
            while attempt < 3:
                try:
                    download_file(url, str(dest), info["size"], label)
                    break
                except Exception as e:
                    attempt += 1
                    if attempt < 3:
                        print(f"  [RETRY {attempt}] {label}: {e}")
                        time.sleep(2)
                    else:
                        print(f"  [FAIL] {label}: {e}")
                        all_ok = False
        if all_ok:
            print(f"  [OK] {voice['id']}")
        else:
            print(f"  [PARTIAL] {voice['id']} — some files failed")


# ---------------------------------------------------------------------------
# New models: Mana-Persian-Piper, pertts, Kamtera male/female VITS
# ---------------------------------------------------------------------------
NEW_MODEL_FILES = [
    {
        "id": "mana-piper",
        "name": "Mana Persian Piper",
        "hf_id": "MahtaFetrat/Mana-Persian-Piper",
        "local_dir": "mana-piper",
        "files": [
            "fa_IR-mana-medium.onnx",
            "fa_IR-mana-medium.onnx.json",
        ],
    },
    {
        "id": "pertts-amir",
        "name": "Pertts Persian (Amir)",
        "hf_id": "SadeghK/persian-text-to-speech",
        "local_dir": "pertts",
        "files": [
            "farsi/amir/epoch=5261-step=2455712.onnx",
            "farsi/amir/epoch=5261-step=2455712.onnx.json",
        ],
    },
    {
        "id": "pertts-ganji",
        "name": "Pertts Persian (Ganji)",
        "hf_id": "SadeghK/persian-text-to-speech",
        "local_dir": "pertts",
        "files": [
            "farsi/ganji/epoch=5719-step=2609600-ganji.onnx",
            "farsi/ganji/epoch=5719-step=2609600-ganji.onnx.json",
        ],
    },
    {
        "id": "pertts-ganji-adabi",
        "name": "Pertts Persian (Ganji Adabi)",
        "hf_id": "SadeghK/persian-text-to-speech",
        "local_dir": "pertts",
        "files": [
            "farsi/ganji-adabi/epoch=6363-step=2694608-ganji-adabi.onnx",
            "farsi/ganji-adabi/epoch=6363-step=2694608-ganji-adabi.onnx.json",
        ],
    },
    {
        "id": "kamtera-male-vits",
        "name": "Kamtera Male VITS",
        "hf_id": "Kamtera/persian-tts-male1-vits",
        "local_dir": "kamtera-male-vits",
        "files": [
            "best_model_199921.pth",
            "config.json",
            "phoneme_cache.zip",
        ],
    },
    {
        "id": "kamtera-female-vits",
        "name": "Kamtera Female VITS",
        "hf_id": "Kamtera/persian-tts-female-vits",
        "local_dir": "kamtera-female-vits",
        "files": [
            "best_model_30824.pth",
            "config.json",
            "phoneme_cache.zip",
        ],
    },
]


def get_file_sizes(hf_id: str, filenames: list[str]) -> dict[str, int]:
    """Get file sizes for specific files in a HF repo."""
    try:
        api = HfApi(token=TOKEN)
        info = api.model_info(hf_id, files_metadata=True)
        sizes = {}
        for f in info.siblings:
            if f.rfilename in filenames:
                sz = f.lfs.size if f.lfs else (f.size or 0)
                sizes[f.rfilename] = sz
        return sizes
    except Exception as e:
        print(f"  [WARN] Could not fetch metadata for {hf_id}: {e}")
        return {}


def download_new_models() -> None:
    """Download new model files (Mana Piper, Pertts, Kamtera VITS)."""
    print("\n=== New Model Downloads ===")
    for entry in NEW_MODEL_FILES:
        model_id = entry["id"]
        hf_id = entry["hf_id"]
        local_dir = entry["local_dir"]
        selected_files = entry["files"]

        local_path = Path(MODELS_DIR) / local_dir
        local_path.mkdir(parents=True, exist_ok=True)

        file_sizes = get_file_sizes(hf_id, selected_files)
        total_size = sum(file_sizes.get(f, 0) for f in selected_files)
        print(f"\n  {model_id} ({hf_id}) — {len(selected_files)} files, {total_size/1024**3:.2f} GB")

        all_ok = True
        for rel in selected_files:
            dest = local_path / rel
            sz = file_sizes.get(rel, 0)

            if dest.is_file() and (sz == 0 or dest.stat().st_size == sz):
                print(f"  [SKIP] {rel} — already exists")
                continue

            os.makedirs(dest.parent, exist_ok=True)
            url = f"https://huggingface.co/{hf_id}/resolve/main/{rel}"
            label = f"{model_id}: {rel}"
            attempt = 0
            while attempt < 3:
                try:
                    download_file(url, str(dest), sz, label)
                    break
                except Exception as e:
                    attempt += 1
                    if attempt < 3:
                        print(f"  [RETRY {attempt}] {label}: {e}")
                        time.sleep(2)
                    else:
                        print(f"  [FAIL] {label}: {e}")
                        all_ok = False

        if all_ok:
            actual = sum(f.stat().st_size for f in local_path.rglob("*") if f.is_file())
            print(f"  [OK] {model_id}: {actual/1024**3:.2f} GB")
        else:
            print(f"  [PARTIAL] {model_id} — some files failed")


TOUCANTTS_HF_ID = "Flux9665/ToucanTTS"


def download_toucantts() -> None:
    """Download only the inference-required ToucanTTS files."""
    local_path = Path(MODELS_DIR) / "ims-toucan"
    local_path.mkdir(parents=True, exist_ok=True)

    print("\n=== ToucanTTS (IMS-Toucan Multilingual) ===")

    api = HfApi(token=TOKEN)
    info = api.model_info(TOUCANTTS_HF_ID, files_metadata=True)
    file_sizes = {}
    for f in info.siblings:
        sz = f.lfs.size if f.lfs else (f.size or 0)
        file_sizes[f.rfilename] = sz

    for fname in TOUCANTTS_FILES:
        dest = local_path / fname
        sz = file_sizes.get(fname, 0)

        if dest.is_file() and (sz == 0 or dest.stat().st_size == sz):
            print(f"  [SKIP] {fname} — already exists")
            continue

        url = f"https://huggingface.co/{TOUCANTTS_HF_ID}/resolve/main/{fname}"
        label = f"toucantts: {fname}"
        attempt = 0
        while attempt < 3:
            try:
                download_file(url, str(dest), sz, label)
                break
            except Exception as e:
                attempt += 1
                if attempt < 3:
                    print(f"  [RETRY {attempt}] {label}: {e}")
                    time.sleep(2)
                else:
                    print(f"  [FAIL] {label}: {e}")

    actual = sum(f.stat().st_size for f in local_path.rglob("*") if f.is_file())
    print(f"  [OK] ToucanTTS: {actual/1024**3:.2f} GB downloaded")


def main() -> None:
    os.makedirs(MODELS_DIR, exist_ok=True)

    for model_id, hf_id, local_dir in MODEL_DOWNLOADS:
        local_path = Path(MODELS_DIR) / local_dir
        expected_files = get_file_list(hf_id)
        if verify_model(local_path, expected_files):
            print(f"[SKIP] {model_id} — complete")
        else:
            if local_path.is_dir():
                shutil.rmtree(local_path)
                print(f"[CLEAN] Removed incomplete {model_id}")
            download_model(model_id, hf_id, local_dir, expected_files)

    download_piper_voices()
    download_toucantts()
    download_new_models()

    all_ids = (
        [m[0] for m in MODEL_DOWNLOADS]
        + [v["id"] for v in PIPER_VOICES]
        + ["ims-toucan"]
        + [e["id"] for e in NEW_MODEL_FILES]
    )
    marker_path = os.path.join(MODELS_DIR, ".models-downloaded")
    with open(marker_path, "w") as f:
        f.write("\n".join(all_ids))
    print(f"\n[OK] Marker file written: {marker_path}")
    print("All models downloaded successfully.")


if __name__ == "__main__":
    main()
