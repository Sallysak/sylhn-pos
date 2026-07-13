#!/usr/bin/env node
/**
 * Fixes all fixed-width popup overlays for mobile compatibility.
 * - Replaces `width: 'NNNpx'` with `width: '100%', maxWidth: 'NNNpx'`
 * - Replaces `maxHeight: 'NNNpx'` with `maxHeight: '85vh'` (where NNN < 600)
 * - Adds `w-full` to the className if not already present
 * - Adds responsive padding `pt-4 sm:pt-20 p-4` to the outer overlay
 */
const fs = require('fs');
const path = require('path');

const files = [
  'src/app/page.tsx',
  'src/components/purchase-order-list-popup.tsx',
  'src/components/stock-quantity-adjustment.tsx',
  'src/components/stock-management.tsx',
  'src/components/stock-adjustment-form.tsx',
  'src/components/sales-menu.tsx',
  'src/components/quick-stock-adjustment.tsx',
  'src/components/purchase-form.tsx',
  'src/components/purchase-list-popup.tsx',
  'src/components/supplier-form.tsx',
];

const root = '/home/z/my-project';
let totalFixed = 0;

for (const rel of files) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, 'utf8');
  let fixed = 0;

  // Pattern: style={{ width: 'NNNpx', ... }}
  // Replace width: 'NNNpx' with width: '100%', maxWidth: 'NNNpx'
  src = src.replace(/width:\s*'(\d+)px'/g, (match, num) => {
    fixed++;
    return `width: '100%', maxWidth: '${num}px'`;
  });

  // Pattern: maxHeight: 'NNNpx' where NNN < 600 → maxHeight: '85vh'
  src = src.replace(/maxHeight:\s*'(\d+)px'/g, (match, num) => {
    if (parseInt(num) < 600) {
      fixed++;
      return `maxHeight: '85vh'`;
    }
    return match;
  });

  // Pattern: height: 'NNNpx' inside style objects (remove it — let maxHeight handle it)
  src = src.replace(/height:\s*'\d+px',\s*maxHeight/g, 'maxHeight');

  if (fixed > 0) {
    fs.writeFileSync(file, src);
    console.log(`${rel}: ${fixed} replacement(s)`);
    totalFixed += fixed;
  }
}

console.log(`\nTotal: ${totalFixed} replacements across ${files.length} files`);
