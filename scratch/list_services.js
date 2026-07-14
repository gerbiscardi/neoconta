const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'node_modules', 'afip.ts', 'lib', 'services');
if (fs.existsSync(dir)) {
  console.log(fs.readdirSync(dir));
} else {
  console.log('Dir not found');
}
