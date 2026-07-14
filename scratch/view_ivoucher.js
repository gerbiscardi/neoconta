const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', 'afip.ts', 'lib', 'services', 'electronic-billing.service.d.ts');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log(content.substring(0, 4000)); // Print the first 4000 characters
} else {
  console.log('File not found:', filePath);
}
