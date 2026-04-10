"use strict";

const fs = require("fs");
const path = require("path");

function ensureValue(value, label) {
  if (!value) {
    throw new Error(`Invalid Feishu intent: missing ${label}.`);
  }

  return value;
}

function parseListItems(lines, title) {
  const collected = [];
  let active = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === `## ${title}`) {
      active = true;
      continue;
    }

    if (active && line.startsWith("## ")) {
      break;
    }

    if (active && line.startsWith("- ")) {
      collected.push(line.slice(2).trim());
    }
  }

  return collected;
}

function parseScalarSection(lines, title) {
  let active = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === `## ${title}`) {
      active = true;
      continue;
    }

    if (active && line.startsWith("## ")) {
      break;
    }

    if (active && line) {
      return line;
    }
  }

  return "";
}

function parseSectionText(lines, titles) {
  const titleSet = new Set(titles.map((title) => `## ${title}`));
  const collected = [];
  let active = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (titleSet.has(trimmed)) {
      active = true;
      continue;
    }

    if (active && trimmed.startsWith("## ")) {
      break;
    }

    if (active) {
      collected.push(line);
    }
  }

  return collected.join("\n").trim();
}

function parseKeyValueItems(items) {
  const result = {};

  for (const item of items) {
    const match = item.match(/^([^=：:]+?)\s*(?:=|：|:)\s*(.+)$/);
    if (!match) {
      continue;
    }

    result[match[1].trim()] = match[2].trim();
  }

  return result;
}

function firstMatch(text, patterns, label) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  if (label) {
    return "";
  }

  return "";
}

function parseFeishuUrl(urlText) {
  const url = new URL(urlText);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const appToken = pathParts[pathParts.length - 1];
  const tableId = url.searchParams.get("table");
  const viewId = url.searchParams.get("view");

  return {
    app_token: ensureValue(appToken, "app token in Feishu URL"),
    table_id: ensureValue(tableId, "table id in Feishu URL"),
    view_id: viewId || undefined
  };
}

function parseRunnerType(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized || normalized === "codex") {
    return "codex";
  }

  if (normalized === "claude" || normalized === "claude_code" || normalized === "claude code") {
    return "claude_code";
  }

  return normalized;
}

function buildFieldValue(rawValue) {
  const normalized = String(rawValue || "").trim().toLowerCase();

  if (normalized === "true") {
    return "true";
  }

  if (normalized === "false") {
    return "false";
  }

  return rawValue;
}

function parseNaturalCredentials(sectionText) {
  return {
    app_id: firstMatch(sectionText, [
      /app_id\s*[：:]\s*(.+)/i,
      /使用\s*app_id\s*[：:]\s*(.+)/i
    ]),
    app_secret: firstMatch(sectionText, [
      /app_secret\s*[：:]\s*(.+)/i,
      /使用\s*app_secret\s*[：:]\s*(.+)/i
    ]),
    request_timeout_ms: firstMatch(sectionText, [
      /request_timeout_ms\s*[：:]\s*(.+)/i,
      /请求超时\s*[：:]\s*(.+)/i
    ])
  };
}

function parseNaturalListenRules(sectionText) {
  return {
    status_field: firstMatch(sectionText, [
      /监听\s*([^\s，。]+)\s*为\s*[^\s，。]+/,
      /当\s*([^\s，。]+)\s*为\s*[^\s，。]+/
    ]) || "状态",
    status_value: firstMatch(sectionText, [
      /监听\s*[^\s，。]+\s*为\s*([^\s，。]+)/,
      /当\s*[^\s，。]+\s*为\s*([^\s，。]+)/
    ]) || "new",
    enabled_field: firstMatch(sectionText, [
      /([^\s，。]+)\s*为\s*(?:true|false|yes|no|是|否)/i
    ]) || "是否交给Codex",
    enabled_value: buildFieldValue(firstMatch(sectionText, [
      /[^\s，。]+\s*为\s*((?:true|false|yes|no|是|否))/i
    ]) || "true")
  };
}

function parseNaturalFieldMappings(sectionText) {
  return {
    title: firstMatch(sectionText, [
      /标题(?:来自|取自)\s*([^\s，。]+)/,
      /把\s*([^\s，。]+)\s*当作标题/
    ]) || "Bug标题",
    description: firstMatch(sectionText, [
      /描述(?:来自|取自)\s*([^\s，。]+)/,
      /详细描述(?:来自|取自)\s*([^\s，。]+)/
    ]) || "Bug描述",
    repro_steps: firstMatch(sectionText, [
      /重现步骤(?:来自|取自)\s*([^\s，。]+)/,
      /复现步骤(?:来自|取自)\s*([^\s，。]+)/
    ]) || "重现步骤",
    expected_result: firstMatch(sectionText, [
      /预期结果(?:来自|取自)\s*([^\s，。]+)/
    ]) || "预期结果",
    priority: firstMatch(sectionText, [
      /优先级(?:来自|取自)\s*([^\s，。]+)/
    ]) || "优先级"
  };
}

function parseNaturalTarget(sectionText, sourceName) {
  return {
    project_name: firstMatch(sectionText, [
      /项目名称\s*[：:]\s*(.+)/,
      /这个任务属于\s*(.+)/
    ]) || sourceName,
    path: firstMatch(sectionText, [
      /去\s*(\/\S+)\s*修改代码/,
      /目录\s*[：:]\s*(\/\S+)/,
      /在\s*(\/\S+)\s*里修改代码/
    ]),
    runner: parseRunnerType(firstMatch(sectionText, [
      /使用\s*(codex|claude(?:_code| code)?)/i,
      /执行器\s*[：:]\s*(.+)/i
    ]) || "codex"),
    verify_command: firstMatch(sectionText, [
      /校验命令\s*[：:]\s*(.+)/,
      /如需校验[，,]?\s*执行\s*(.+)/
    ])
  };
}

function parseNaturalCompletion(sectionText) {
  return {
    status_field: firstMatch(sectionText, [
      /把\s*([^\s，。]+)\s*改成\s*[^\s，。]+/
    ]) || "状态",
    success_value: firstMatch(sectionText, [
      /完成以后把[^\s，。]+改成\s*([^\s，。]+)/,
      /处理完成后把[^\s，。]+改成\s*([^\s，。]+)/
    ]) || "fixed",
    result_field: firstMatch(sectionText, [
      /把处理结果写入\s*([^\s，。]+)/,
      /处理结果写到\s*([^\s，。]+)/
    ]) || "Codex处理结果",
    process_time_field: firstMatch(sectionText, [
      /把处理时间写入\s*([^\s，。]+)/,
      /处理时间写到\s*([^\s，。]+)/
    ]) || "处理时间",
    error_field: firstMatch(sectionText, [
      /失败时把错误写入\s*([^\s，。]+)/,
      /错误写到\s*([^\s，。]+)/
    ]) || "最后错误",
    processing_value: firstMatch(sectionText, [
      /开始处理时把[^\s，。]+改成\s*([^\s，。]+)/
    ]) || "processing",
    failure_value: firstMatch(sectionText, [
      /失败时把[^\s，。]+改成\s*([^\s，。]+)/
    ]) || "failed"
  };
}

function compileFeishuIntent(intentPath, options = {}) {
  const sourceId = options.sourceName || path.basename(intentPath, path.extname(intentPath));
  const text = fs.readFileSync(intentPath, "utf8");
  const lines = text.split(/\r?\n/);

  const sourceDisplayName = parseScalarSection(lines, "来源名称");
  const pollUrl = parseScalarSection(lines, "轮询目标") || firstMatch(
    parseSectionText(lines, ["接入信息"]),
    [
      /轮询这个多维表格[：:]\s*(https?:\/\/\S+)/,
      /监听这个多维表格[：:]\s*(https?:\/\/\S+)/,
      /(https?:\/\/\S+)/
    ]
  );
  const credentialsSection = parseSectionText(lines, ["飞书凭证", "接入信息"]);
  const listenSection = parseSectionText(lines, ["监听条件", "当满足这些条件时"]);
  const fieldSection = parseSectionText(lines, ["需求字段", "把这些内容当作需求"]);
  const targetSection = parseSectionText(lines, ["处理目标", "交给哪个工程处理"]);
  const completionSection = parseSectionText(lines, ["完成后", "处理完成后"]);

  const credentials = {
    ...parseKeyValueItems(parseListItems(lines, "飞书凭证")),
    ...parseNaturalCredentials(credentialsSection)
  };
  const listenRules = {
    ...parseKeyValueItems(parseListItems(lines, "监听条件")),
    ...parseNaturalListenRules(listenSection)
  };
  const fieldMappings = {
    ...parseKeyValueItems(parseListItems(lines, "需求字段")),
    ...parseNaturalFieldMappings(fieldSection)
  };
  const targetConfig = {
    ...parseKeyValueItems(parseListItems(lines, "处理目标")),
    ...parseNaturalTarget(targetSection, sourceDisplayName || sourceId)
  };
  const completionActions = {
    ...parseKeyValueItems(parseListItems(lines, "完成后")),
    ...parseNaturalCompletion(completionSection)
  };

  const parsedUrl = parseFeishuUrl(ensureValue(pollUrl, "poll target URL"));
  const requestTimeoutMs = Number(credentials.request_timeout_ms || 30000);

  return {
    type: "feishu_bitable",
    name: sourceDisplayName || sourceId,
    enabled: true,
    credentials: {
      app_id: ensureValue(credentials.app_id, "app_id"),
      app_secret: ensureValue(credentials.app_secret, "app_secret")
    },
    request_timeout_ms: Number.isFinite(requestTimeoutMs) ? requestTimeoutMs : 30000,
    matching: {
      status_field: listenRules.status_field || "状态",
      status_value: listenRules.status_value || "new",
      enabled_field: listenRules.enabled_field || "是否交给Codex",
      enabled_value: buildFieldValue(listenRules.enabled_value || "true")
    },
    issue_fields: {
      title: fieldMappings.title || "Bug标题",
      description: fieldMappings.description || "Bug描述",
      repro_steps: fieldMappings.repro_steps || "重现步骤",
      expected_result: fieldMappings.expected_result || "预期结果",
      priority: fieldMappings.priority || "优先级"
    },
    writeback: {
      status_field: completionActions.status_field || "状态",
      result_field: completionActions.result_field || "Codex处理结果",
      process_time_field: completionActions.process_time_field || "处理时间",
      error_field: completionActions.error_field || "最后错误",
      processing_value: completionActions.processing_value || "processing",
      success_value: completionActions.success_value || "fixed",
      failure_value: completionActions.failure_value || "failed"
    },
    projects: [
      {
        name: targetConfig.project_name || sourceDisplayName || sourceId,
        path: ensureValue(targetConfig.path, "target path"),
        runner: {
          type: parseRunnerType(targetConfig.runner || "codex")
        },
        verify_command: targetConfig.verify_command || "",
        enabled: true,
        ...parsedUrl
      }
    ]
  };
}

module.exports = {
  compileFeishuIntent
};
