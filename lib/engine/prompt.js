"use strict";

function buildBugPrompt(project, issue) {
  return [
    `You are fixing a bug in the project "${project.name}".`,
    `Work in the repository at ${project.path}.`,
    "Read the existing code first, make the minimal correct change, and edit files directly.",
    "If the repository is not a git repo, continue anyway.",
    "Do not ask follow-up questions. Complete the fix based on the bug report.",
    "",
    "Bug report:",
    `- Title: ${issue.title || "(empty)"}`,
    `- Description: ${issue.description || "(empty)"}`,
    `- Repro steps: ${issue.reproSteps || "(empty)"}`,
    `- Expected result: ${issue.expectedResult || "(empty)"}`,
    `- Priority: ${issue.priority || "(empty)"}`,
    "",
    "Requirements:",
    "- Implement the bug fix in code.",
    "- Keep changes focused and pragmatic.",
    "- After editing, provide a short summary of what changed.",
    "- If the bug report is underspecified, make the smallest reasonable assumption and proceed."
  ].join("\n");
}

module.exports = {
  buildBugPrompt
};
