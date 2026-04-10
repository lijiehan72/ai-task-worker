"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { runCommand } = require("../engine/command");

function buildSetupPrompt(conversation) {
  return [
    "You are a setup agent for an AI Task Worker repository.",
    "Your job is to turn a user's freeform setup request into a source intent draft.",
    "",
    "Current runtime support:",
    "- Supported now: feishu_bitable",
    "- Not yet supported in runtime but may appear in user requests: nginx_logs, pm2_logs",
    "",
    "Your response must be valid JSON only. No markdown fences.",
    "",
    "JSON shape:",
    "{",
    '  "source_type": "feishu_bitable|nginx_logs|pm2_logs|unknown",',
    '  "supported_now": true,',
    '  "summary": "short human-readable summary",',
    '  "source_display_name": "human display name",',
    '  "suggested_relative_path": "./sources/feishu/intent/name.md",',
    '  "missing_questions": ["question 1", "question 2"],',
    '  "intent_markdown": "full intent markdown or empty string",',
    '  "why_not_ready": "why missing or unsupported",',
    '  "notes": ["optional note"]',
    "}",
    "",
    "Rules:",
    "- If the request clearly targets a Feishu Bitable source and enough information is present, supported_now=true and output full intent_markdown.",
    "- If information is missing, ask only the minimum missing questions.",
    "- If the user requests nginx or pm2 logs, set supported_now=false, explain runtime is not implemented yet, and still ask useful missing questions if needed.",
    "- For Feishu intents, generate natural Chinese intent markdown using these sections exactly:",
    "  ## 来源名称",
    "  ## 接入信息",
    "  ## 当满足这些条件时",
    "  ## 把这些内容当作需求",
    "  ## 交给哪个工程处理",
    "  ## 处理完成后",
    "- Prefer reasonable defaults when the user intent is obvious:",
    '  status field "状态", status value "new", enabled field "是否交给Codex", enabled value "true".',
    '  title "Bug标题", description "Bug描述", repro steps "重现步骤", expected result "预期结果", priority "优先级".',
    '  processing status "processing", success status "fixed", failure status "failed".',
    "- Runner can be codex or claude. Convert claude to natural text `claude` in intent markdown.",
    "- suggested_relative_path must be stable and filesystem-safe.",
    "",
    "Conversation:",
    conversation
  ].join("\n");
}

function extractJson(text) {
  const trimmed = String(text || "").trim();

  if (!trimmed) {
    throw new Error("Setup agent returned empty output.");
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]+?)```/i);
  if (fencedMatch) {
    return JSON.parse(fencedMatch[1]);
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return JSON.parse(trimmed);
}

async function analyzeConversation(conversation) {
  const outputPath = path.join(
    os.tmpdir(),
    `setup-agent-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`
  );

  const args = [
    "exec",
    "--skip-git-repo-check",
    "--output-last-message",
    outputPath,
    buildSetupPrompt(conversation)
  ];

  const result = await runCommand("codex", args, {
    cwd: process.cwd()
  });

  let text = "";

  try {
    if (fs.existsSync(outputPath)) {
      text = fs.readFileSync(outputPath, "utf8");
    } else {
      text = result.stdout || "";
    }
  } finally {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  }

  if (!result.ok && !text.trim()) {
    throw new Error(result.error || result.stderr || `codex exited with code ${result.code}`);
  }

  const parsed = extractJson(text);

  return {
    ...parsed,
    raw_output: text
  };
}

module.exports = {
  analyzeConversation
};
