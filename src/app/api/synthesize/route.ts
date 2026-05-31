import { getModelById } from "@/lib/models";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

async function runPython(scriptPath: string, pythonBin: string, inputData: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonBin, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, 300000);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error("Python process timed out after 300s"));
      } else if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr || `Process exited with code ${code}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.stdin.write(inputData);
    proc.stdin.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, modelId, refAudio } = body as {
      text: string;
      modelId: string;
      refAudio?: string;
    };

    if (!text || !modelId) {
      return NextResponse.json(
        { error: "Missing required fields: text and modelId" },
        { status: 400 }
      );
    }

    const model = getModelById(modelId);
    if (!model) {
      return NextResponse.json({ error: "Invalid modelId" }, { status: 400 });
    }

    const localPath = path.join(process.cwd(), model.localDir);
    if (!fs.existsSync(localPath)) {
      return NextResponse.json(
        { error: `Model not downloaded. Run setup script first.` },
        { status: 503 }
      );
    }

    const ttsScript = path.join(process.cwd(), "src/lib/tts.py");

    const payload = JSON.stringify({
      modelId,
      text,
      refAudio,
      modelPath: localPath,
      outputDir: "/tmp",
      device: "auto",
    });

    const venvPython = path.join(process.cwd(), ".venv/bin/python3");
    const python = fs.existsSync(venvPython) ? venvPython : process.env.PYTHON_BIN || "python3";

    const { stdout, stderr } = await runPython(ttsScript, python, payload);

    console.log(`[TTS ${modelId}] Python stdout length: ${stdout.length}`);
    if (stderr) {
      console.warn(`[TTS ${modelId}] Python stderr:`, stderr);
    }

    const result = JSON.parse(stdout);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      audioBase64: result.audioBase64,
      format: result.format || "wav",
      duration: result.duration,
    });
  } catch (error: unknown) {
    console.error("[synthesize] Error:", error);
    const msg = error instanceof Error ? error.message : "Inference failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
