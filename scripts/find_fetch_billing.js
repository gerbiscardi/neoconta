const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'dashboard', 'facturacion', 'page.js');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('/api/arca/facturar')) {
    console.log(`Lines ${idx-10} to ${idx+20}:`);
    for (let i = idx-10; i <= idx+20; i++) {
      if (lines[i]) {
        console.log(`${i+1}: ${lines[i]}`);
      }
    }
  }
});
