"use strict";

const { processIssue } = require("../../engine/issue-runner");
const { logSourceScan } = require("../../engine/logger");
const { hasProcessedRecord, markRecordProcessed } = require("../../engine/state");
const { getTenantAccessToken, listRecords, updateRecord } = require("./client");
const {
  summarizeIssue,
  selectNextRecord,
  buildProcessingFields,
  buildFinalFields
} = require("./fields");

async function tryUpdateRecord(tenantAccessToken, project, recordId, fields, requestTimeoutMs) {
  try {
    await updateRecord(tenantAccessToken, project, recordId, fields, {
      requestTimeoutMs
    });
    return null;
  } catch (error) {
    return error.message;
  }
}

async function runProject(sourceConfig, project, options = {}) {
  const requestTimeoutMs = sourceConfig.request_timeout_ms;
  const statusField = (sourceConfig.matching && sourceConfig.matching.status_field) || "状态";
  const tenantAccessToken = await getTenantAccessToken(sourceConfig, {
    requestTimeoutMs
  });
  const records = await listRecords(tenantAccessToken, project, {
    requestTimeoutMs
  });
  const missingStatusCount = records.filter((record) => {
    const fields = record.fields || {};
    return !Object.prototype.hasOwnProperty.call(fields, statusField);
  }).length;
  const alreadyProcessedCount = records.filter((record) => hasProcessedRecord(record)).length;
  const selected = selectNextRecord(records, hasProcessedRecord, sourceConfig);

  logSourceScan(sourceConfig.name, {
    source: sourceConfig.name,
    source_type: sourceConfig.type,
    project: project.name,
    total_records: records.length,
    missing_status_count: missingStatusCount,
    already_processed_count: alreadyProcessedCount,
    matched_count: selected ? 1 : 0,
    idle: !selected
  });

  if (!selected) {
    return {
      source: sourceConfig.name,
      project: project.name,
      matched: false,
      totalRecords: records.length,
      missingStatusCount
    };
  }

  const issue = summarizeIssue(selected, sourceConfig);

  return processIssue({
    source: sourceConfig.name,
    project,
    issue,
    hooks: {
      buildProcessingPayload(meta) {
        return {
          fields: buildProcessingFields(selected.fields || {}, meta, sourceConfig)
        };
      },
      buildFinalPayload(meta) {
        return buildFinalFields(selected.fields || {}, meta, sourceConfig);
      },
      async tryUpdate(payload) {
        return tryUpdateRecord(
          tenantAccessToken,
          project,
          selected.record_id,
          payload.fields,
          requestTimeoutMs
        );
      },
      markProcessed(meta) {
        markRecordProcessed(selected, meta);
      }
    }
  }, options);
}

async function runSourceCycle(sourceConfig, options = {}) {
  const enabledProjects = (sourceConfig.projects || []).filter((project) => project.enabled);
  const results = [];

  for (const project of enabledProjects) {
    results.push(await runProject(sourceConfig, project, options));
  }

  return results;
}

module.exports = {
  runSourceCycle
};
