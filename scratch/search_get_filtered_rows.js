const fs = require('fs');
const content = fs.readFileSync('app/dashboard/facturacion/page.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('const getFilteredRows')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
    for (let i = 1; i <= 35; i++) {
      console.log(`  +${i}: ${lines[idx + i]}`);
    }
  }
});
