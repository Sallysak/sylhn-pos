#!/usr/bin/env node
/**
 * Wraps bare <table> elements (with w-full className) inside a
 * <div className="mobile-scroll-x"> wrapper so they scroll horizontally on mobile.
 */
const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('Usage: node wrap-tables.js <file.tsx>'); process.exit(1); }

const fullpath = '/home/z/my-project/' + file;
const src = fs.readFileSync(fullpath, 'utf8');
const lines = src.split('\n');

// Match lines like: <table className="w-full text-sm"> or <table className="w-full text-xs" style={{...}}>
const tableOpenRe = /^(\s*)<table\s+className="w-full[^"]*"\s*(style=\{\{[^}]*\}\})?>\s*$/;
let out = [];
let i = 0;
let wrapped = 0;

while (i < lines.length) {
  const line = lines[i];
  const m = line.match(tableOpenRe);
  if (m) {
    // Check previous line for existing wrapper
    let prevIdx = out.length - 1;
    while (prevIdx >= 0 && out[prevIdx].trim() === '') prevIdx--;
    const prevLine = prevIdx >= 0 ? out[prevIdx] : '';
    if (prevLine.includes('mobile-scroll-x')) {
      out.push(line);
      i++;
      continue;
    }
    const indent = m[1] || '';
    // Find closing </table>
    let closeIdx = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].match(/^(\s*)<\/table>/)) { closeIdx = j; break; }
    }
    if (closeIdx === -1) { out.push(line); i++; continue; }
    out.push(`${indent}<div className="mobile-scroll-x">`);
    for (let k = i; k <= closeIdx; k++) out.push(lines[k]);
    out.push(`${indent}</div>`);
    wrapped++;
    i = closeIdx + 1;
  } else {
    out.push(line);
    i++;
  }
}

fs.writeFileSync(fullpath, out.join('\n'));
console.log(`${file}: wrapped ${wrapped} table(s)`);
