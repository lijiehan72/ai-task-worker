"use strict";

const { buildBugPrompt } = require("./prompt");
const { runCommand } = require("./command");

function getRunnerConfig(project, options = {}) {
  return project.runner || options.defaultRunner || {};
}

function buildClaudeArgs(project, issue, options = {}) {
  const runnerConfig = getRunnerConfig(project, options);
  const args = [
    "-p",
    buildBugPrompt(project, issue),
    "--output-format",
    "json"
  ];

  if (runnerConfig.model) {
    args.push("--model", runnerConfig.model);
  }

  if (runnerConfig.permission_mode) {
    args.push("--permission-mode", runnerConfig.permission_mode);
  }

  if (runnerConfig.max_turns) {
    args.push("--max-turns", String(runnerConfig.max_turns));
  }

  if (runnerConfig.append_system_prompt) {
    args.push("--append-system-prompt", runnerConfig.append_system_prompt);
  }

  return args;
}

function parseClaudeSummary(stdout) {
  const text = String(stdout || "").trim();

  if (!text) {
    return "";
  }

  try {
    const payload = JSON.parse(text);
    if (payload && typeof payload.result === "string") {
      return payload.result.trim();
    }
  } catch {
    return text;
  }

  return text;
}

async function runClaudeFix(project, issue, options = {}) {
  const result = await runCommand("claude", buildClaudeArgs(project, issue, options), {
    cwd: project.path
  });

  return {
    ...result,
    summary: parseClaudeSummary(result.stdout)
  };
}

module.exports = {
  runClaudeFix
};
