"use strict";

const { loadConfig } = require("../config");
const { getTenantAccessToken, listRecords, updateRecord } = require("../lib/sources/feishu/client");

async function main() {
  const { config } = loadConfig();
  const source = config.sources.find((item) => item.type === "feishu_bitable" && item.enabled !== false);

  if (!source) {
    throw new Error("No enabled feishu_bitable source found in config.");
  }

  const project = (source.projects || []).find((item) => item.enabled !== false);

  if (!project) {
    throw new Error(`No project found for source "${source.name}"`);
  }

  const requestTimeoutMs = source.request_timeout_ms;
  const tenantAccessToken = await getTenantAccessToken(source, { requestTimeoutMs });
  const records = await listRecords(tenantAccessToken, project, { requestTimeoutMs });
  const record = records[0];

  if (!record) {
    throw new Error(`No records found for project "${project.name}"`);
  }

  const randomValue = `permission-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const updated = await updateRecord(
    tenantAccessToken,
    project,
    record.record_id,
    {
      "Codex处理结果": randomValue
    },
    { requestTimeoutMs }
  );

  console.log("Update succeeded.");
  console.log(`Source: ${source.name}`);
  console.log(`Project: ${project.name}`);
  console.log(`Record ID: ${record.record_id}`);
  console.log(`Codex处理结果: ${randomValue}`);
  console.log(JSON.stringify(updated, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
