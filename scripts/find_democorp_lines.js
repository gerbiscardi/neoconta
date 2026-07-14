const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'dashboard', 'page.js');
const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Demo Corp')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
