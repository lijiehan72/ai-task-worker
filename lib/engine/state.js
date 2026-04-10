"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STATE_PATH = path.resolve(process.cwd(), "data", "state.json");
const LEGACY_STATE_PATH = path.resolve(process.cwd(), "worker", "state.json");

function getReadableStatePath() {
  if (fs.existsSync(STATE_PATH)) {
    return STATE_PATH;
  }

  if (fs.existsSync(LEGACY_STATE_PATH)) {
    return LEGACY_STATE_PATH;
  }

  return STATE_PATH;
}

function ensureStateDir() {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
}

function loadState() {
  const statePath = getReadableStatePath();

  if (!fs.existsSync(statePath)) {
    return { processed: {} };
  }

  try {
    const value = JSON.parse(fs.readFileSync(statePath, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { processed: {} };
    }

    if (!value.processed || typeof value.processed !== "object" || Array.isArray(value.processed)) {
      return { processed: {} };
    }

    return value;
  } catch {
    return { processed: {} };
  }
}

function saveState(state) {
  ensureStateDir();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function buildRecordFingerprint(record) {
  const fields = record.fields || {};
  const payload = {
    recordId: record.record_id,
    title: fields["Bug标题"] || "",
    description: fields["Bug描述"] || "",
    reproSteps: fields["重现步骤"] || "",
    expectedResult: fields["预期结果"] || "",
    priority: fields["优先级"] || ""
  };

  return crypto
    .createHash("sha1")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function hasProcessedRecord(record) {
  const state = loadState();
  const entry = state.processed[record.record_id];

  if (!entry) {
    return false;
  }

  return entry.fingerprint === buildRecordFingerprint(record);
}

function markRecordProcessed(record, meta = {}) {
  const state = loadState();
  state.processed[record.record_id] = {
    fingerprint: buildRecordFingerprint(record),
    updatedAt: new Date().toISOString(),
    ...meta
  };
  saveState(state);
}

module.exports = {
  hasProcessedRecord,
  markRecordProcessed,
  loadState
};
