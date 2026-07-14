const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', 'afip.ts', 'lib', 'soap', 'interfaces', 'PersonaServiceA5', 'PersonaServiceA5Port.d.ts');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  console.log('--- Iimpuesto ---');
  let print = false;
  let braces = 0;
  lines.forEach((line, idx) => {
    if (line.includes('interface Iimpuesto')) {
      print = true;
    }
    if (print) {
      console.log(`${idx+1}: ${line}`);
      if (line.includes('{')) braces++;
      if (line.includes('}')) braces--;
      if (braces === 0 && line.includes('}')) print = false;
    }
  });

  console.log('\n--- Icaracterizacion ---');
  print = false;
  braces = 0;
  lines.forEach((line, idx) => {
    if (line.includes('interface Icaracterizacion')) {
      print = true;
    }
    if (print) {
      console.log(`${idx+1}: ${line}`);
      if (line.includes('{')) braces++;
      if (line.includes('}')) braces--;
      if (braces === 0 && line.includes('}')) print = false;
    }
  });

} else {
  console.log('File not found');
}
