#!/usr/bin/env node
import fs from 'fs';

const raw = fs.readFileSync('eslint_report.json', 'utf8');
if (!raw || raw.trim().length===0) {
    console.error('eslint_report.json is empty');
    process.exit(2);
}
const data = JSON.parse(raw);

// per-file counts using messages + suppressedMessages + fatalErrorCount
const fileCounts = data.map(item => {
    const m = item.messages || [];
    const s = item.suppressedMessages || [];
    const fatal = item.fatalErrorCount || 0;
    return { file: item.filePath, problems: m.length + s.length + fatal, messages: m, suppressed: s };
});
fileCounts.sort((a,b)=> b.problems - a.problems);
const top10 = fileCounts.slice(0,10);

// aggregate by ruleId across messages and suppressedMessages
const ruleCounts = new Map();
for (const item of data) {
    const both = [].concat(item.messages||[], item.suppressedMessages||[]);
    for (const msg of both) {
        const rid = msg.ruleId || '<unknown>';
        const arr = ruleCounts.get(rid) || [];
        arr.push({ file: item.filePath, line: msg.line, column: msg.column, message: msg.message });
        ruleCounts.set(rid, arr);
    }
}

const ruleSummary = Array.from(ruleCounts.entries()).map(([rule, arr]) => ({ rule, count: arr.length, samples: arr.slice(0,3) }));
ruleSummary.sort((a,b)=> b.count - a.count);
const topRules = ruleSummary.slice(0, 50);

fs.writeFileSync('eslint_top10_files.json', JSON.stringify({ totalFiles: fileCounts.length, top10 }, null, 2));
fs.writeFileSync('eslint_top_rules.json', JSON.stringify({ totalRules: ruleSummary.length, topRules }, null, 2));
console.log('wrote eslint_top10_files.json and eslint_top_rules.json');
