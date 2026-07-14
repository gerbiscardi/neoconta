const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const config = {
  host: '200.58.98.237',
  port: 22,
  username: 'root',
  password: '3/TJwP1VTp5Okv'
};

let output = '';

function executeCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    output += `\n--- Executing: ${cmd} ---\n`;
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', (code) => {
        output += out;
        resolve(out);
      }).on('data', (data) => {
        out += data.toString();
      }).stderr.on('data', (data) => {
        output += `[stderr] ${data.toString()}`;
      });
    });
  });
}

conn.on('ready', async () => {
  try {
    // Print 10 lines of context after "AFIP Error processing invoice"
    await executeCommand(conn, 'grep -A 15 "AFIP Error processing invoice" /root/.pm2/logs/neoconta-error.log* || echo "No matches"');
    
    fs.writeFileSync(path.join(__dirname, 'grep_results.txt'), output, 'utf-8');
    console.log('Saved results to grep_results.txt');
    conn.end();
  } catch (error) {
    console.error('Error:', error);
    conn.end();
  }
}).connect(config);
