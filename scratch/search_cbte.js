const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      searchDir(filePath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('CbteTipo') || content.includes('cbteTipo')) {
        console.log(`Found in: ${filePath}`);
        // print matching lines
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('CbteTipo') || line.includes('cbteTipo')) {
            console.log(`  L${idx+1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

searchDir(path.join(__dirname, '..', 'app'));
