const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'dashboard', 'page.js');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('currentUser') || line.includes('role') || line.includes('owner') || line.includes('cliente')) {
    if (line.includes('===') || line.includes('==') || line.includes('?') || line.includes('&&') || line.includes('if') || line.includes('role:')) {
      console.log(`${index + 1}: ${line}`);
    }
  }
});
