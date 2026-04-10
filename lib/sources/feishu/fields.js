"use strict";

function getField(fields, candidates) {
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(fields, candidate)) {
      return fields[candidate];
    }
  }

  return undefined;
}

function valueToString(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(valueToString).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    if (typeof value.text === "string") {
      return value.text;
    }

    if (typeof value.name === "string") {
      return value.name;
    }
  }

  return "";
}

function normalizeBooleanText(value) {
  return valueToString(value).trim().toLowerCase();
}

function toLogicalBoolean(value) {
  const normalized = normalizeBooleanText(value);

  if (["true", "yes", "是", "1"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "否", "0"].includes(normalized)) {
    return false;
  }

  return null;
}

function isEnabledValue(actualValue, configuredValue) {
  const actualBoolean = toLogicalBoolean(actualValue);
  const configuredBoolean = toLogicalBoolean(configuredValue);

  if (actualBoolean != null && configuredBoolean != null) {
    return actualBoolean === configuredBoolean;
  }

  return normalizeBooleanText(actualValue) === normalizeBooleanText(configuredValue);
}

function isStatusMatch(fields, matchingConfig) {
  const statusField = matchingConfig.status_field || "状态";
  const statusValue = matchingConfig.status_value || "new";
  return normalizeBooleanText(fields[statusField]) === normalizeBooleanText(statusValue);
}

function summarizeIssue(record, sourceConfig) {
  const fields = record.fields || {};
  const issueFields = sourceConfig.issue_fields || {};
  const matching = sourceConfig.matching || {};

  return {
    recordId: record.record_id,
    title: valueToString(fields[issueFields.title || "Bug标题"]),
    description: valueToString(fields[issueFields.description || "Bug描述"]),
    reproSteps: valueToString(fields[issueFields.repro_steps || "重现步骤"]),
    expectedResult: valueToString(fields[issueFields.expected_result || "预期结果"]),
    priority: valueToString(fields[issueFields.priority || "优先级"]),
    status: valueToString(fields[matching.status_field || "状态"]),
    codexEnabled: valueToString(fields[matching.enabled_field || "是否交给Codex"])
  };
}

function selectNextRecord(records, hasProcessedRecord, sourceConfig) {
  const matching = sourceConfig.matching || {};
  const statusField = matching.status_field || "状态";
  const enabledField = matching.enabled_field || "是否交给Codex";
  const enabledValue = matching.enabled_value || "true";

  return records.find((record) => {
    const fields = record.fields || {};
    if (!Object.prototype.hasOwnProperty.call(fields, statusField)) {
      return false;
    }

    if (!isStatusMatch(fields, matching) || !isEnabledValue(fields[enabledField], enabledValue)) {
      return false;
    }

    return !hasProcessedRecord(record);
  });
}

function buildProcessingFields(recordFields, meta, sourceConfig) {
  const writeback = sourceConfig.writeback || {};
  const statusField = writeback.status_field || "状态";
  const resultField = writeback.result_field || "Codex处理结果";
  const processTimeField = writeback.process_time_field || "处理时间";
  const errorField = writeback.error_field || "最后错误";
  const processingValue = writeback.processing_value || "processing";

  const fields = {
    [resultField]: "Worker picked this issue and is ready for AI execution.",
    [processTimeField]: meta.processTime
  };

  if (Object.prototype.hasOwnProperty.call(recordFields || {}, statusField)) {
    fields[statusField] = processingValue;
  }

  if (Object.prototype.hasOwnProperty.call(recordFields || {}, errorField)) {
    fields[errorField] = "";
  }

  return fields;
}

function buildFinalFields(recordFields, meta, sourceConfig) {
  const writeback = sourceConfig.writeback || {};
  const statusField = writeback.status_field || "状态";
  const resultField = writeback.result_field || "Codex处理结果";
  const processTimeField = writeback.process_time_field || "处理时间";
  const errorField = writeback.error_field || "最后错误";
  const successValue = writeback.success_value || "fixed";
  const failureValue = writeback.failure_value || "failed";

  const fields = {
    [resultField]: meta.resultText,
    [processTimeField]: meta.processTime
  };

  if (Object.prototype.hasOwnProperty.call(recordFields || {}, statusField)) {
    fields[statusField] = meta.runFailed ? failureValue : successValue;
  }

  if (meta.runFailed && Object.prototype.hasOwnProperty.call(recordFields || {}, errorField)) {
    fields[errorField] = meta.resultText.slice(0, 2000);
  }

  return {
    fields,
    status: fields[statusField]
  };
}

module.exports = {
  valueToString,
  getField,
  isEnabledValue,
  isStatusMatch,
  summarizeIssue,
  selectNextRecord,
  buildProcessingFields,
  buildFinalFields
};
