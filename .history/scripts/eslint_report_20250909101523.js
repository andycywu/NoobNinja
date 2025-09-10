#!/usr/bin/env node
// Generate ESLint report for `source/**` using ESLint Node API and write JSON to eslint_report.json
import { ESLint } from 'eslint';
import fs from 'fs';

async function run() {
    const eslint = new ESLint({
        overrideConfigFile: './eslint.config.js',
    });
    const results = await eslint.lintFiles(['source/**']);
    const formatter = await eslint.loadFormatter('json');
    const resultText = formatter.format(results);
    fs.writeFileSync('eslint_report.json', resultText);
    console.log('wrote eslint_report.json', results.length, 'files');
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
