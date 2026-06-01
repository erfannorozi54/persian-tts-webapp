#!/usr/bin/env bash
# Setup script for Persian TTS Web App
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV_DIR="$SCRIPT_DIR/.venv"

echo "=== Persian TTS Setup ==="

# Step 1: Create venv
if [ -d "$VENV_DIR" ]; then
    echo "[OK] Virtual environment exists at $VENV_DIR"
else
    echo "[1/4] Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    echo "[OK] Created"
fi

# Step 2: Activate and install deps
source "$VENV_DIR/bin/activate"
echo "[2/4] Installing Python dependencies..."
pip install --upgrade pip

# Clone and install fish-speech from source (required for inference scripts)
FISH_SPEECH_DIR="$SCRIPT_DIR/fish-speech-repo"
if [ ! -d "$FISH_SPEECH_DIR" ]; then
    echo "  Cloning fish-speech repo..."
    git clone https://github.com/fishaudio/fish-speech.git "$FISH_SPEECH_DIR"
fi
pip install -e "$FISH_SPEECH_DIR"

# Clone and install MOSS-TTS from source (not on PyPI as mos-tts)
MOSS_TTS_DIR="$SCRIPT_DIR/moss-tts-repo"
if [ ! -d "$MOSS_TTS_DIR" ]; then
    echo "  Cloning MOSS-TTS repo..."
    git clone https://github.com/OpenMOSS/MOSS-TTS.git "$MOSS_TTS_DIR"
fi
pip install -e "$MOSS_TTS_DIR"

pip install -r requirements.txt
echo "[OK] Dependencies installed"

# Step 3: Download models
echo "[3/4] Downloading models (this may take a while, ~25GB total)..."
python3 scripts/download-models.py
echo "[OK] Models downloaded"

# Step 4: Download fish-speech checkpoint into model dir
echo "[4/4] Downloading fish-speech S2 Pro checkpoint..."
source "$VENV_DIR/bin/activate"
python3 -c "
import os
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id='fishaudio/s2-pro',
    local_dir='models/fishaudio-s2-pro',
    ignore_patterns=['.gitattributes', '.git'],
    token=os.getenv('HF_TOKEN'),
)
"
echo "[OK] S2 Pro checkpoint downloaded"

# Step 5: Chatterbox TTS venv (separate venv to avoid torch/transformers version conflicts)
CHATTERBOX_VENV="$SCRIPT_DIR/.venv-chatterbox"
if [ -d "$CHATTERBOX_VENV" ]; then
    echo "[OK] Chatterbox venv exists at $CHATTERBOX_VENV"
else
    echo "[5/5] Creating Chatterbox venv (Python 3.11)..."
    if command -v python3.11 &> /dev/null; then
        python3.11 -m venv "$CHATTERBOX_VENV"
    else
        echo "[WARN] python3.11 not found, trying python3..."
        python3 -m venv "$CHATTERBOX_VENV"
    fi
    echo "[OK] Chatterbox venv created"
fi

echo "  Installing chatterbox-tts and dependencies..."
"$CHATTERBOX_VENV/bin/pip" install --upgrade pip
"$CHATTERBOX_VENV/bin/pip" install chatterbox-tts

echo ""
echo "=== Setup Complete ==="
echo "Run 'npm run dev' to start the development server."
