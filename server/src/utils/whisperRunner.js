const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
 * Resolve Whisper command:
 * - WHISPER_PYTHON set → use that Python with "python -m whisper" (e.g. venv)
 * - Otherwise → use "python3 -m whisper" so pip-installed whisper works without CLI on PATH
 */
function getWhisperCommand() {
  const pythonPath = process.env.WHISPER_PYTHON;
  if (pythonPath && fs.existsSync(pythonPath)) {
    return { cmd: pythonPath, useModule: true };
  }
  // Default: python3 -m whisper (works after pip install openai-whisper, no CLI on PATH needed)
  return { cmd: "python3", useModule: true };
}

/**
 * Run Whisper on extracted audio to generate SRT.
 * CLI: whisper audio.wav --model small --output_format srt --output_dir /path [--language en]
 * Or: python -m whisper audio.wav ... (when WHISPER_PYTHON is set)
 */
function runWhisper(
  audioPath,
  { model = "small", language = "auto", outputDir } = {}
) {
  return new Promise((resolve, reject) => {
    const outputDirectory = outputDir || path.dirname(audioPath);
    const { cmd, useModule } = getWhisperCommand();

    const args = ["-m", "whisper", audioPath, "--model", model, "--output_format", "srt", "--output_dir", outputDirectory];
    if (language && language !== "auto") {
      args.push("--language", language);
    }

    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      reject(
        new Error(
          `Whisper failed to start. Is it installed? (pip install openai-whisper) ${err.message}`
        )
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const out = stderr || stdout;
        if (/No module named ['"]?whisper['"]?/i.test(out)) {
          reject(
            new Error(
              "Whisper is not installed for this Python. Run: python3 -m pip install openai-whisper (or use a venv and set WHISPER_PYTHON in server/.env)"
            )
          );
        } else {
          reject(new Error(`Whisper exited with code ${code}\n\n${out}`));
        }
      }
    });
  });
}

/**
 * SRT path Whisper writes: same dir as audio, same base name, .srt
 */
function getExpectedSrtPath(audioPath) {
  const dir = path.dirname(audioPath);
  const base = path.basename(audioPath, path.extname(audioPath));
  return path.join(dir, `${base}.srt`);
}

module.exports = {
  runWhisper,
  getExpectedSrtPath,
};
