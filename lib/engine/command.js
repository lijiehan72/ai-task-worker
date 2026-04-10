"use strict";

const { spawn } = require("child_process");

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        code: null,
        stdout,
        stderr,
        error: error.message
      });
    });

    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr
      });
    });
  });
}

function summarizeCommandResult(result) {
  const pieces = [];

  if (typeof result.code === "number") {
    pieces.push(`exit_code=${result.code}`);
  }

  if (result.error) {
    pieces.push(`error=${result.error}`);
  }

  const stderr = (result.stderr || "").trim();
  if (stderr) {
    pieces.push(`stderr=${stderr.slice(0, 500)}`);
  }

  const stdout = (result.stdout || "").trim();
  if (stdout) {
    pieces.push(`stdout=${stdout.slice(0, 500)}`);
  }

  return pieces.join("\n");
}

module.exports = {
  runCommand,
  summarizeCommandResult
};
