"use strict";

const fs = require("fs");
const path = require("path");
const { compileFeishuIntent } = require("../lib/sources/feishu/intent");

function collectIntentFiles(baseDir) {
  if (!fs.existsSync(baseDir)) {
    return [];
  }

  return fs.readdirSync(baseDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(baseDir, name));
}

function main() {
  const sourceRoot = path.resolve(process.cwd(), "sources", "feishu");
  const intentDir = path.join(sourceRoot, "intent");
  const configDir = path.join(sourceRoot, "config");
  const files = collectIntentFiles(intentDir);

  fs.mkdirSync(configDir, { recursive: true });

  for (const intentPath of files) {
    const baseName = path.basename(intentPath, path.extname(intentPath));
    const compiled = compileFeishuIntent(intentPath, {
      sourceName: baseName
    });
    const outputPath = path.join(configDir, `${baseName}.json`);
    fs.writeFileSync(outputPath, `${JSON.stringify(compiled, null, 2)}\n`);
    console.log(`Compiled ${path.relative(process.cwd(), intentPath)} -> ${path.relative(process.cwd(), outputPath)}`);
  }
}

main();
