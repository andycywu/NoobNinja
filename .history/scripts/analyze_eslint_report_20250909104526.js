#!/usr/bin/env node
import fs from 'fs';

const raw = fs.readFileSync('eslint_report.json', 'utf8');
const data = JSON.parse(raw || '[]');

const counts = data.map(item => ({ file: item.filePath, problems: item.errorCount + item.warningCount + item.fatalErrorCount }));
counts.sort((a,b)=> b.problems - a.problems);
const top10 = counts.slice(0, 10);
fs.writeFileSync('eslint_top10.json', JSON.stringify({ top10, totalFiles: counts.length }, null, 2));
console.log('wrote eslint_top10.json');
