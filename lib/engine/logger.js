"use strict";

const fs = require("fs");
const path = require("path");

function formatDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function sanitizeSegment(value) {
  return String(value || "unknown")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function appendJsonl(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`);
}

function buildLogEvent(event, payload = {}) {
  return {
    time: new Date().toISOString(),
    event,
    ...payload
  };
}

function getSourceLogPath(sourceName, kind, date = new Date()) {
  const safeSourceName = sanitizeSegment(sourceName);
  const day = formatDay(date);
  return path.resolve(process.cwd(), "logs", safeSourceName, `${kind}-${day}.jsonl`);
}

function getSystemLogPath(date = new Date()) {
  const day = formatDay(date);
  return path.resolve(process.cwd(), "logs", "system", `worker-${day}.jsonl`);
}

function log(message, extra) {
  const prefix = `[${new Date().toISOString()}]`;

  if (extra === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }

  console.log(`${prefix} ${message}`, extra);
}

function logSystemEvent(event, payload = {}) {
  appendJsonl(getSystemLogPath(), buildLogEvent(event, payload));
}

function logSourceScan(sourceName, payload = {}) {
  appendJsonl(getSourceLogPath(sourceName, "scan"), buildLogEvent("scan_summary", payload));
}

function logSourceIssue(sourceName, event, payload = {}) {
  appendJsonl(getSourceLogPath(sourceName, "issues"), buildLogEvent(event, payload));
}

module.exports = {
  log,
  logSystemEvent,
  logSourceScan,
  logSourceIssue
};
