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
    if (content.includes('tickets') || content.includes('TA-') || content.includes('ta_folder') || content.includes('res_folder')) {
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
    if (line.includes('tickets') || line.includes('TA-') || line.includes('ta_folder') || line.includes('res_folder') || line.includes('ticket')) {
      console.log(`  L${idx+1}: ${line.trim()}`);
    }
  });
});
