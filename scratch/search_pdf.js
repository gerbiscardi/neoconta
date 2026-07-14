const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'dashboard', 'facturacion', 'page.js');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const buildInvoicePDF') || lines[i].includes('function buildInvoicePDF')) {
    start = i;
    break;
  }
}

if (start !== -1) {
  console.log(`buildInvoicePDF starts at line ${start + 1}`);
  for (let i = start; i < start + 120; i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
} else {
  console.log('buildInvoicePDF function not found');
}
