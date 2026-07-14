const fs = require('fs');
const content = fs.readFileSync('app/dashboard/facturacion/page.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('<tbody') || line.includes('tbody>')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
