const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'dashboard', 'facturacion', 'page.js');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Historial y Comprobantes ARCA')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
