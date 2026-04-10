"use strict";

const { loadConfig } = require("../config");
const { getTenantAccessToken, listRecords } = require("../lib/sources/feishu/client");
const {
  valueToString,
  isEnabledValue,
  isStatusMatch
} = require("../lib/sources/feishu/fields");

function parseArgs(argv) {
  const args = {
    config: null,
    projectName: null,
    sourceName: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--config") {
      index += 1;
      args.config = argv[index] || null;
      continue;
    }

    if (token === "--project") {
      index += 1;
      args.projectName = argv[index] || null;
      continue;
    }

    if (token === "--source") {
      index += 1;
      args.sourceName = argv[index] || null;
    }
  }

  return args;
}

function summarizeRecord(record, source) {
  const fields = record.fields || {};
  const matching = source.matching || {};
  const statusField = matching.status_field || "状态";
  const enabledField = matching.enabled_field || "是否交给Codex";
  const enabledValue = matching.enabled_value || "true";
  const titleField = (source.issue_fields && source.issue_fields.title) || "Bug标题";
  const statusValue = fields[statusField];
  const enabledFieldValue = fields[enabledField];
  const reasons = [];

  if (!Object.prototype.hasOwnProperty.call(fields, statusField)) {
    reasons.push(`缺少字段 "${statusField}"`);
  } else if (!isStatusMatch(fields, matching)) {
    reasons.push(`状态不是 new，当前是 "${valueToString(statusValue)}"`);
  }

  if (!Object.prototype.hasOwnProperty.call(fields, enabledField)) {
    reasons.push(`缺少字段 "${enabledField}"`);
  } else if (!isEnabledValue(enabledFieldValue, enabledValue)) {
    reasons.push(`${enabledField} 不是可识别的启用值，当前是 "${valueToString(enabledFieldValue)}"`);
  }

  return {
    recordId: record.record_id,
    fields: Object.keys(fields),
    title: valueToString(fields[titleField]),
    statusRaw: statusValue,
    statusText: valueToString(statusValue),
    statusIsNew: isStatusMatch(fields, matching),
    codexFieldName: enabledField,
    codexRaw: enabledFieldValue,
    codexText: valueToString(enabledFieldValue),
    codexEnabled: isEnabledValue(enabledFieldValue, enabledValue),
    matched: reasons.length === 0,
    skipReasons: reasons
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { configPath, config } = loadConfig(args.config);
  const source = args.sourceName
    ? config.sources.find((item) => item.name === args.sourceName)
    : config.sources.find((item) => item.type === "feishu_bitable" && item.enabled !== false);

  if (!source) {
    throw new Error("No enabled feishu_bitable source found in config.");
  }

  const enabledProjects = (source.projects || []).filter((project) => project && project.enabled !== false);
  const project = args.projectName
    ? enabledProjects.find((item) => item.name === args.projectName)
    : enabledProjects[0];

  if (!project) {
    throw new Error(`Project not found: ${args.projectName || "(default project missing)"}`);
  }

  const requestTimeoutMs = source.request_timeout_ms;
  const tenantAccessToken = await getTenantAccessToken(source, { requestTimeoutMs });
  const records = await listRecords(tenantAccessToken, project, { requestTimeoutMs });
  const summaries = records.map((record) => summarizeRecord(record, source));

  console.log(`Config: ${configPath}`);
  console.log(`Source: ${source.name}`);
  console.log(`Project: ${project.name}`);
  console.log(`App token: ${project.app_token}`);
  console.log(`Table ID: ${project.table_id}`);
  console.log(`View ID: ${project.view_id || "(none)"}`);
  console.log(`Records returned by Feishu: ${records.length}`);
  console.log("");

  if (summaries.length === 0) {
    console.log("No records returned. Check app_token/table_id/view_id and view filters.");
    return;
  }

  for (const summary of summaries) {
    console.log("=".repeat(80));
    console.log(`Record ID: ${summary.recordId}`);
    console.log(`Bug标题: ${summary.title || "(empty)"}`);
    console.log(`字段名: ${summary.fields.join(", ") || "(none)"}`);
    console.log(`状态原值: ${JSON.stringify(summary.statusRaw)}`);
    console.log(`状态文本: ${summary.statusText || "(empty)"}`);
    console.log(`状态匹配 new: ${summary.statusIsNew}`);
    console.log(`Codex 字段名: ${summary.codexFieldName || "(missing)"}`);
    console.log(`Codex 原值: ${JSON.stringify(summary.codexRaw)}`);
    console.log(`Codex 文本: ${summary.codexText || "(empty)"}`);
    console.log(`Codex 启用: ${summary.codexEnabled}`);
    console.log(`会被当前程序选中: ${summary.matched}`);

    if (summary.skipReasons.length > 0) {
      console.log(`跳过原因: ${summary.skipReasons.join("；")}`);
    }

    console.log("原始 fields:");
    console.log(JSON.stringify(records.find((item) => item.record_id === summary.recordId).fields || {}, null, 2));
    console.log("");
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
