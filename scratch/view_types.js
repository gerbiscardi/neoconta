const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', 'afip.ts', 'lib', 'types.d.ts');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log(content.substring(0, 4000));
} else {
  // Let's find any other .ts or .d.ts files in the types folder
  const typesDir = path.join(__dirname, '..', 'node_modules', 'afip.ts', 'lib');
  console.log('Files in lib:', fs.readdirSync(typesDir));
}
