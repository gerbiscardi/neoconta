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

const occurrences = [];
walkDir(path.join(__dirname, '..'), (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.json') || filePath.endsWith('.html')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('Demo Corp') || content.includes('DemoCorp')) {
      occurrences.push(filePath);
    }
  }
});

console.log('Occurrences of Demo Corp:');
occurrences.forEach(o => console.log(o));
fs.writeFileSync(path.join(__dirname, 'democorp_results.txt'), occurrences.join('\n'));
