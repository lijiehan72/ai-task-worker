"use strict";

const fs = require("fs");
const path = require("path");
const { compileFeishuIntent } = require("../lib/sources/feishu/intent");

function resolveConfigPath(customPath) {
  if (!customPath) {
    return path.resolve(process.cwd(), "config", "config.json");
  }

  return path.resolve(process.cwd(), customPath);
}

function ensureObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid worker config: "${label}" must be an object.`);
  }
}

function normalizeLegacyConfig(config) {
  ensureObject(config.feishu, "feishu");

  return {
    worker: config.worker,
    sources: [
      {
        type: "feishu_bitable",
        name: "default-feishu",
        enabled: true,
        credentials: {
          app_id: config.feishu.app_id,
          app_secret: config.feishu.app_secret
        },
        request_timeout_ms: config.feishu.request_timeout_ms,
        projects: config.projects || []
      }
    ]
  };
}

function normalizeConfig(config) {
  ensureObject(config, "root");
  ensureObject(config.worker, "worker");

  if (Array.isArray(config.source_files)) {
    return {
      worker: config.worker,
      source_files: config.source_files
    };
  }

  if (Array.isArray(config.sources)) {
    return config;
  }

  if (config.feishu) {
    if (!Array.isArray(config.projects)) {
      throw new Error('Invalid worker config: "projects" must be an array.');
    }

    return normalizeLegacyConfig(config);
  }

  throw new Error('Invalid worker config: expected "sources" array or legacy "feishu" config.');
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read ${label} at ${filePath}: ${error.message}`);
  }
}

function loadSourceFile(configDir, sourceFile) {
  const fullPath = path.isAbsolute(sourceFile)
    ? sourceFile
    : path.resolve(process.cwd(), sourceFile);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Source config file not found: ${fullPath}`);
  }

  if (fullPath.endsWith(".json")) {
    return readJson(fullPath, "source config");
  }

  if (fullPath.endsWith(".md")) {
    const normalized = fullPath.replace(/\\/g, "/");

    if (normalized.includes("/sources/feishu/intent/")) {
      return compileFeishuIntent(fullPath, {
        sourceName: path.basename(fullPath, path.extname(fullPath))
      });
    }

    throw new Error(`Unsupported intent file: ${fullPath}`);
  }

  throw new Error(`Unsupported source file format: ${fullPath}`);
}

function resolveSources(config, configPath) {
  if (Array.isArray(config.sources)) {
    return config.sources;
  }

  if (!Array.isArray(config.source_files)) {
    throw new Error('Invalid worker config: missing "source_files".');
  }

  const configDir = path.dirname(configPath);
  return config.source_files.map((sourceFile) => loadSourceFile(configDir, sourceFile));
}

function applyRunnerOverride(config) {
  const runnerType = process.env.WORKER_RUNNER_TYPE;

  if (!runnerType) {
    return config;
  }

  return {
    ...config,
    worker: {
      ...config.worker,
      runner_override_type: runnerType
    },
    sources: (config.sources || []).map((source) => ({
      ...source,
      projects: (source.projects || []).map((project) => ({
        ...project,
        runner: {
          ...(project.runner || {}),
          type: runnerType
        }
      }))
    }))
  };
}

function loadConfig(customPath) {
  const configPath = resolveConfigPath(customPath);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Worker config file not found: ${configPath}`);
  }

  let config;

  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read worker config at ${configPath}: ${error.message}`);
  }

  const normalizedConfig = normalizeConfig(config);
  const resolvedConfig = {
    worker: normalizedConfig.worker,
    sources: resolveSources(normalizedConfig, configPath)
  };

  return {
    configPath,
    config: applyRunnerOverride(resolvedConfig)
  };
}

module.exports = {
  loadConfig
};
