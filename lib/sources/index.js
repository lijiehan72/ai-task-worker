"use strict";

const { runSourceCycle: runFeishuSourceCycle } = require("./feishu/source");

const SOURCE_RUNNERS = {
  feishu_bitable: runFeishuSourceCycle
};

async function runAllSources(config, options = {}) {
  const results = [];

  for (const source of config.sources.filter((item) => item.enabled !== false)) {
    const runner = SOURCE_RUNNERS[source.type];

    if (!runner) {
      throw new Error(`Unsupported source type: ${source.type}`);
    }

    const sourceResults = await runner(source, options);
    results.push(...sourceResults);
  }

  return results;
}

module.exports = {
  runAllSources
};
