const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', 'afip.ts', 'lib', 'services', 'register-scope-five.service.d.ts');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log(content);
} else {
  console.log('File not found');
}
