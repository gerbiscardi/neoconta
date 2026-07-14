const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'dashboard', 'facturacion', 'page.js');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

const terms = ['error', 'observaciones', 'rechazada', 'regla de negocio', 'estado afip', 'afip_response', 'estado'];

lines.forEach((line, idx) => {
  const match = terms.some(term => line.toLowerCase().includes(term));
  if (match) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
