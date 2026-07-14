const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const sdkDir = path.join(__dirname, '..', 'node_modules', 'afip.ts');
const matches = [];

walkDir(sdkDir, (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('createInvoice') || content.includes('electronicBillingService')) {
      matches.push(filePath);
    }
  }
});

console.log('Matches:');
matches.forEach(m => {
  console.log(m);
  const content = fs.readFileSync(m, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('createInvoice') || line.includes('FECAESolicitar') || line.includes('electronicBillingService')) {
      console.log(`  L${idx+1}: ${line.trim()}`);
    }
  });
});
