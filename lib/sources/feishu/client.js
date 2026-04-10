"use strict";

const https = require("https");

const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

function getRequestTimeoutMs(options = {}) {
  const value = Number(options.requestTimeoutMs);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  return Math.floor(value);
}

function describeRequestError(error) {
  if (!error) {
    return "Unknown request error";
  }

  const parts = [error.message || String(error)];

  if (error.code) {
    parts.push(`code=${error.code}`);
  }

  if (error.cause && error.cause !== error) {
    if (error.cause.code) {
      parts.push(`cause_code=${error.cause.code}`);
    }

    if (error.cause.message) {
      parts.push(`cause=${error.cause.message}`);
    }
  }

  return parts.join(" | ");
}

function requestJson(url, options = {}) {
  const timeoutMs = getRequestTimeoutMs(options);
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...(options.headers || {})
  };
  const body = options.body == null ? null : JSON.stringify(options.body);

  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: options.method || "GET",
      headers
    });

    const timer = setTimeout(() => {
      request.destroy(Object.assign(new Error(`Request timeout after ${timeoutMs}ms`), {
        code: "REQUEST_TIMEOUT"
      }));
    }, timeoutMs);

    request.on("response", (response) => {
      let text = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        text += chunk;
      });

      response.on("end", () => {
        clearTimeout(timer);

        let payload = null;

        try {
          payload = text ? JSON.parse(text) : null;
        } catch (error) {
          reject(new Error(`Failed to parse Feishu response JSON: ${error.message}`));
          return;
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          const message = payload && payload.msg ? payload.msg : `HTTP ${response.statusCode}`;
          reject(new Error(`Feishu API request failed: ${message}`));
          return;
        }

        if (payload && typeof payload.code === "number" && payload.code !== 0) {
          reject(new Error(`Feishu API error ${payload.code}: ${payload.msg || "Unknown error"}`));
          return;
        }

        resolve(payload);
      });
    });

    request.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    if (body) {
      request.write(body);
    }

    request.end();
  });
}

async function getTenantAccessToken(sourceConfig, options = {}) {
  let payload;

  try {
    payload = await requestJson(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      body: {
        app_id: sourceConfig.credentials.app_id,
        app_secret: sourceConfig.credentials.app_secret
      },
      requestTimeoutMs: options.requestTimeoutMs
    });
  } catch (error) {
    throw new Error(`Failed to request tenant access token: ${describeRequestError(error)}`);
  }

  return payload.tenant_access_token;
}

async function listRecords(tenantAccessToken, project, options = {}) {
  const query = new URLSearchParams({
    page_size: "20"
  });

  if (project.view_id) {
    query.set("view_id", project.view_id);
  }

  const url = `${FEISHU_API_BASE}/bitable/v1/apps/${project.app_token}/tables/${project.table_id}/records?${query.toString()}`;
  let payload;

  try {
    payload = await requestJson(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tenantAccessToken}`
      },
      requestTimeoutMs: options.requestTimeoutMs
    });
  } catch (error) {
    throw new Error(`Failed to list records for project "${project.name}": ${describeRequestError(error)}`);
  }

  return payload.data.items || [];
}

async function updateRecord(tenantAccessToken, project, recordId, fields, options = {}) {
  const url = `${FEISHU_API_BASE}/bitable/v1/apps/${project.app_token}/tables/${project.table_id}/records/${recordId}`;
  let payload;

  try {
    payload = await requestJson(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${tenantAccessToken}`
      },
      body: { fields },
      requestTimeoutMs: options.requestTimeoutMs
    });
  } catch (error) {
    throw new Error(`Failed to update record "${recordId}" for project "${project.name}": ${describeRequestError(error)}`);
  }

  return payload.data.record;
}

module.exports = {
  getTenantAccessToken,
  listRecords,
  updateRecord
};
