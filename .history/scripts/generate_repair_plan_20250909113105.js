#!/usr/bin/env node
import fs from 'fs';

const raw = fs.readFileSync('eslint_report.json', 'utf8');
if (!raw || raw.trim().length===0) {
    console.error('eslint_report.json is empty');
    process.exit(2);
}
const report = JSON.parse(raw);

// compute per-file total problems and fixable count
const perFile = report.map(item => {
    const msgs = item.messages || [];
    const suppressed = item.suppressedMessages || [];
    const all = msgs.concat(suppressed);
    const fixable = all.filter(m => m.fix).length;
    const ruleCounts = {};
    for (const m of all) {
        const r = m.ruleId || '<unknown>';
        ruleCounts[r] = (ruleCounts[r] || 0) + 1;
    }
    return {
        file: item.filePath,
        totalProblems: all.length + (item.fatalErrorCount||0),
        fixableCount: fixable,
        topRules: Object.entries(ruleCounts).sort((a,b)=> b[1]-a[1]).slice(0,5).map(([rule,count])=>({rule,count}))
    };
});

perFile.sort((a,b)=> b.totalProblems - a.totalProblems);
const top10 = perFile.slice(0,10);

const manualRules = new Set(['no-await-in-loop','no-extend-native','no-control-regex','no-undef','no-loop-func','no-constructor-return']);

const plan = top10.map(item => {
    const entry = { file: item.file, totalProblems: item.totalProblems, fixableCount: item.fixableCount, topRules: item.topRules };
    const needsManual = item.topRules.some(r => manualRules.has(r.rule));
    entry.recommendation = item.fixableCount > 0 ? 'auto-try --fix for fixable issues, then manual review' : 'manual review required';
    if (needsManual) {
        entry.notes = 'Contains rules that typically require manual inspection: ' + item.topRules.filter(r=>manualRules.has(r.rule)).map(r=>r.rule).join(', ');
    }
    return entry;
});

fs.writeFileSync('eslint_repair_plan.json', JSON.stringify({ generated: new Date().toISOString(), totalFiles: perFile.length, top10: plan }, null, 2));

// write a short markdown report
let md = `# ESLint Repair Plan\n\nGenerated: ${new Date().toISOString()}\n\nTop-10 files to address:\n\n`;
for (const p of plan) {
    md += `- **${p.file}** — problems: ${p.totalProblems}, fixable: ${p.fixableCount}\n`;
    md += `  - top rules: ${p.topRules.map(r=>`${r.rule}(${r.count})`).join(', ')}\n`;
    md += `  - recommendation: ${p.recommendation}\n`;
    if (p.notes) md += `  - notes: ${p.notes}\n`;
}
md += '\nSuggested next action: run `npx eslint <file> --fix` for files with fixable issues, commit in small batches, then manually inspect rules flagged above.\n';
fs.writeFileSync('eslint_repair_plan.md', md);
console.log('wrote eslint_repair_plan.json and eslint_repair_plan.md');
