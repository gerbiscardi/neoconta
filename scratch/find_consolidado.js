const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'dashboard', 'page.js');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.toLowerCase().includes('consolidado') || line.toLowerCase().includes('tiempo real')) {
    console.log(`${index + 1}: ${line}`);
  }
});
