const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.next' && f !== '.venv' && f !== '.git') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

const matches = [];
walkDir(path.join(__dirname, '..'), (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('new Afip')) {
      matches.push(filePath);
    }
  }
});

console.log('Matches for "new Afip":');
matches.forEach(m => console.log(m));
