"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildBugPrompt } = require("./prompt");
const { runCommand } = require("./command");

async function runCodexFix(project, issue) {
  const outputPath = path.join(
    os.tmpdir(),
    `codex-last-message-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`
  );

  const args = [
    "exec",
    "--full-auto",
    "--skip-git-repo-check",
    "--cd",
    project.path,
    "--output-last-message",
    outputPath,
    buildBugPrompt(project, issue)
  ];

  const result = await runCommand("codex", args, {
    cwd: project.path
  });

  let summary = "";

  try {
    if (fs.existsSync(outputPath)) {
      summary = fs.readFileSync(outputPath, "utf8").trim();
    }
  } finally {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  }

  return {
    ...result,
    summary
  };
}

module.exports = {
  runCodexFix
};
