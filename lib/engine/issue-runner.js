"use strict";

const { runFix, runVerifyCommand, summarizeCommandResult, getRunnerType } = require("./runner");
const { logSourceIssue } = require("./logger");

function formatProcessTime(date = new Date()) {
  return date.getTime();
}

async function processIssue(context, options = {}) {
  const { issue, project, hooks } = context;
  const warnings = [];
  const runnerType = getRunnerType(project, options);

  logSourceIssue(context.source, "issue_selected", {
    source: context.source,
    project: project.name,
    issue_id: issue.recordId || null,
    title: issue.title || "",
    dry_run: Boolean(options.dryRun),
    runner: runnerType
  });

  const processingPayload = hooks.buildProcessingPayload({
    processTime: formatProcessTime()
  });

  if (!options.dryRun) {
    const processingError = await hooks.tryUpdate(processingPayload);
    if (processingError) {
      warnings.push(`Failed to mark record as processing: ${processingError}`);
      logSourceIssue(context.source, "issue_processing_update_failed", {
        source: context.source,
        project: project.name,
        issue_id: issue.recordId || null,
        title: issue.title || "",
        error: processingError
      });
    } else {
      logSourceIssue(context.source, "issue_processing_started", {
        source: context.source,
        project: project.name,
        issue_id: issue.recordId || null,
        title: issue.title || "",
        status: processingPayload.fields && processingPayload.fields["状态"]
      });
    }
  }

  if (options.dryRun) {
    logSourceIssue(context.source, "issue_dry_run", {
      source: context.source,
      project: project.name,
      issue_id: issue.recordId || null,
      title: issue.title || "",
      runner: runnerType
    });
    return {
      source: context.source,
      project: project.name,
      matched: true,
      dryRun: true,
      issue
    };
  }

  const executionResult = await runFix(project, issue, options);
  const verifyResult = executionResult.ok ? await runVerifyCommand(project) : null;
  const resultLines = [];

  if (executionResult.ok) {
    resultLines.push(`${executionResult.runner} execution succeeded.`);
  } else {
    resultLines.push(`${executionResult.runner} execution failed.`);
    resultLines.push(summarizeCommandResult(executionResult));
  }

  if (executionResult.summary) {
    resultLines.push("");
    resultLines.push(`${executionResult.runner} summary:`);
    resultLines.push(executionResult.summary.slice(0, 2000));
  }

  if (verifyResult) {
    resultLines.push("");

    if (verifyResult.skipped) {
      resultLines.push(`Verification skipped: ${verifyResult.reason}.`);
    } else if (verifyResult.ok) {
      resultLines.push("Verification succeeded.");
    } else {
      resultLines.push("Verification failed.");
      resultLines.push(summarizeCommandResult(verifyResult));
    }
  }

  const runFailed = !executionResult.ok || (verifyResult && !verifyResult.ok && !verifyResult.skipped);
  const finalPayload = hooks.buildFinalPayload({
    processTime: formatProcessTime(),
    runFailed,
    resultText: resultLines.filter(Boolean).join("\n")
  });

  const finalUpdateError = await hooks.tryUpdate(finalPayload);

  if (finalUpdateError) {
    warnings.push(`Failed to write final result: ${finalUpdateError}`);
    logSourceIssue(context.source, "issue_final_update_failed", {
      source: context.source,
      project: project.name,
      issue_id: issue.recordId || null,
      title: issue.title || "",
      status: finalPayload.status || null,
      error: finalUpdateError
    });
  }

  hooks.markProcessed({
    executionOk: Boolean(executionResult.ok),
    runner: executionResult.runner,
    verifyOk: verifyResult ? Boolean(verifyResult.ok) : null,
    remoteWriteOk: !finalUpdateError,
    finalStatus: finalPayload.status || null
  });

  logSourceIssue(context.source, "issue_processed", {
    source: context.source,
    project: project.name,
    issue_id: issue.recordId || null,
    title: issue.title || "",
    status: finalPayload.status || null,
    runner: executionResult.runner,
    execution_ok: Boolean(executionResult.ok),
    verify_ok: verifyResult ? Boolean(verifyResult.ok) : null,
    verify_skipped: verifyResult ? Boolean(verifyResult.skipped) : null,
    remote_write_ok: !finalUpdateError,
    warnings
  });

  return {
    source: context.source,
    project: project.name,
    matched: true,
    dryRun: false,
    issue,
    warnings,
    execution: {
      ok: executionResult.ok,
      summary: executionResult.summary,
      runner: executionResult.runner
    },
    verify: verifyResult
      ? {
          ok: Boolean(verifyResult.ok),
          skipped: Boolean(verifyResult.skipped),
          reason: verifyResult.reason
        }
      : null
  };
}

module.exports = {
  processIssue
};
