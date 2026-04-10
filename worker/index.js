"use strict";

const { loadConfig } = require("../config");
const { log, logSystemEvent } = require("../lib/engine/logger");
const { runAllSources } = require("../lib/sources");

function parseArgs(argv) {
  return {
    once: argv.includes("--once"),
    configPath: (() => {
      const index = argv.indexOf("--config");
      return index >= 0 ? argv[index + 1] : undefined;
    })()
  };
}

async function runCycle(config) {
  logSystemEvent("worker_cycle_started", {
    dry_run: Boolean(config.worker.dry_run)
  });

  const results = await runAllSources(config, {
    dryRun: config.worker.dry_run
  });

  for (const result of results) {
    if (!result.matched) {
      if (result.missingStatusCount) {
        log(
          `No pending issue found for source "${result.source}" project "${result.project}". Checked ${result.totalRecords} record(s), ` +
          `${result.missingStatusCount} record(s) missing the "${"状态"}" field in API response.`
        );
      } else {
        log(`No pending issue found for source "${result.source}" project "${result.project}". Checked ${result.totalRecords} record(s).`);
      }
      continue;
    }

    log(`Selected issue for source "${result.source}" project "${result.project}".`, result);
  }

  logSystemEvent("worker_cycle_finished", {
    dry_run: Boolean(config.worker.dry_run),
    source_results: results.map((result) => ({
      source: result.source,
      project: result.project,
      matched: Boolean(result.matched),
      total_records: result.totalRecords || null,
      warnings: Array.isArray(result.warnings) ? result.warnings.length : 0
    }))
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { configPath, config } = loadConfig(args.configPath);

  log(`Loaded worker config from ${configPath}.`);
  log(`Worker dry_run=${config.worker.dry_run}, poll_interval_seconds=${config.worker.poll_interval_seconds}.`);
  logSystemEvent("worker_started", {
    config_path: configPath,
    dry_run: Boolean(config.worker.dry_run),
    poll_interval_seconds: config.worker.poll_interval_seconds,
    once: Boolean(args.once)
  });

  if (args.once) {
    await runCycle(config);
    return;
  }

  await runCycle(config);

  setInterval(() => {
    runCycle(config).catch((error) => {
      log(`Worker cycle failed: ${error.message}`);
      logSystemEvent("worker_cycle_failed", {
        error: error.message
      });
    });
  }, config.worker.poll_interval_seconds * 1000);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  logSystemEvent("worker_failed", {
    error: error.stack || error.message
  });
  process.exitCode = 1;
});
