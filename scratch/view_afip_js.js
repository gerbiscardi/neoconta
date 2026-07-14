const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', 'afip.ts', 'lib', 'afip.d.ts');
if (fs.existsSync(filePath)) {
  console.log(fs.readFileSync(filePath, 'utf-8'));
} else {
  console.log('File not found');
}
