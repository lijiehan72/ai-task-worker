"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { analyzeConversation } = require("../lib/setup/codex-setup-agent");

const CONFIG_PATH = path.resolve(process.cwd(), "config", "config.json");

function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Config file not found: ${CONFIG_PATH}`);
  }

  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

function ensureSourceFileRegistered(relativePath) {
  const config = readConfig();

  if (!Array.isArray(config.source_files)) {
    config.source_files = [];
  }

  if (!config.source_files.includes(relativePath)) {
    config.source_files.push(relativePath);
    writeConfig(config);
  }
}

function renderConversation(history) {
  return history
    .map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${item.text}`)
    .join("\n\n");
}

function printAnalysis(analysis) {
  console.log("");
  console.log("配置代理理解如下：");
  console.log(analysis.summary || "(no summary)");

  if (analysis.notes && analysis.notes.length > 0) {
    console.log("");
    console.log("备注：");
    for (const note of analysis.notes) {
      console.log(`- ${note}`);
    }
  }
}

async function collectConversation(rl) {
  const history = [];

  console.log("AI Setup Agent");
  console.log("");
  console.log("直接描述你想让这个程序监听什么、怎么处理即可。");
  console.log("例如：");
  console.log("监听这个飞书多维表格……去 /root/work/demo 修改代码，使用 codex，完成后把状态改成 fixed。");
  console.log("");

  const initial = await question(rl, "你的需求描述: ");
  history.push({ role: "user", text: initial });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const analysis = await analyzeConversation(renderConversation(history));
    printAnalysis(analysis);

    if (analysis.supported_now && (!analysis.missing_questions || analysis.missing_questions.length === 0) && analysis.intent_markdown) {
      return {
        history,
        analysis
      };
    }

    if (analysis.missing_questions && analysis.missing_questions.length > 0) {
      console.log("");
      for (const q of analysis.missing_questions) {
        const answer = await question(rl, `${q} `);
        history.push({ role: "assistant", text: q });
        history.push({ role: "user", text: answer });
      }
      continue;
    }

    return {
      history,
      analysis
    };
  }

  return {
    history,
    analysis: await analyzeConversation(renderConversation(history))
  };
}

function saveIntentFile(analysis) {
  const relativePath = analysis.suggested_relative_path;

  if (!relativePath) {
    throw new Error("Setup agent did not provide suggested_relative_path.");
  }

  const fullPath = path.resolve(process.cwd(), relativePath.replace(/^\.\//, ""));
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, `${analysis.intent_markdown.trim()}\n`);
  ensureSourceFileRegistered(relativePath);

  return {
    fullPath,
    relativePath
  };
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const { analysis } = await collectConversation(rl);

    if (!analysis.supported_now) {
      console.log("");
      console.log("当前还不能直接写入可运行配置。");
      console.log(analysis.why_not_ready || "来源暂未接入 runtime。");
      return;
    }

    if (!analysis.intent_markdown) {
      console.log("");
      console.log("配置代理还没能生成完整 intent。");
      console.log(analysis.why_not_ready || "缺少必要信息。");
      return;
    }

    console.log("");
    console.log("生成的 intent 预览：");
    console.log("");
    console.log(analysis.intent_markdown);
    console.log("");

    const confirm = await question(rl, "确认写入这个配置吗？(y/N): ");

    if (!["y", "yes"].includes(confirm.toLowerCase())) {
      console.log("已取消写入。");
      return;
    }

    const saved = saveIntentFile(analysis);
    console.log("");
    console.log(`已生成来源意图文件: ${saved.fullPath}`);
    console.log(`已写入 config/config.json 的 source_files: ${saved.relativePath}`);
    console.log("");
    console.log("下一步可以直接运行：");
    console.log("npm run once:codex");
    console.log("或");
    console.log("npm run once:claude");
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
