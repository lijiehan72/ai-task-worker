"use strict";

const fs = require("fs");
const path = require("path");
const { runCodexFix } = require("./codex-runner");
const { runClaudeFix } = require("./claude-runner");
const { runCommand, summarizeCommandResult } = require("./command");

function getRunnerConfig(project, options = {}) {
  return project.runner || options.defaultRunner || { type: "codex" };
}

function getRunnerType(project, options = {}) {
  const runnerConfig = getRunnerConfig(project, options);
  return runnerConfig.type || "codex";
}

async function runFix(project, issue, options = {}) {
  const runnerType = getRunnerType(project, options);

  if (runnerType === "codex") {
    return {
      runner: "codex",
      ...(await runCodexFix(project, issue))
    };
  }

  if (runnerType === "claude_code") {
    return {
      runner: "claude_code",
      ...(await runClaudeFix(project, issue, options))
    };
  }

  return {
    runner: runnerType,
    ok: false,
    code: null,
    stdout: "",
    stderr: "",
    error: `Unsupported runner type: ${runnerType}`,
    summary: ""
  };
}

function shouldSkipVerify(project) {
  if (!project.verify_command) {
    return {
      skip: true,
      reason: "verify_command is empty"
    };
  }

  const needsPackageJson = /^(npm|pnpm|yarn)\s+/.test(project.verify_command.trim());
  if (needsPackageJson && !fs.existsSync(path.join(project.path, "package.json"))) {
    return {
      skip: true,
      reason: "package.json not found"
    };
  }

  return {
    skip: false
  };
}

async function runVerifyCommand(project) {
  const skip = shouldSkipVerify(project);
  if (skip.skip) {
    return {
      ok: true,
      skipped: true,
      reason: skip.reason
    };
  }

  const result = await runCommand("bash", ["-lc", project.verify_command], {
    cwd: project.path
  });

  return {
    ...result,
    skipped: false
  };
}

module.exports = {
  runFix,
  runVerifyCommand,
  summarizeCommandResult,
  getRunnerType
};
