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
    // Search for POST requests to /api/admin/users or /api/auth/registro on June 14
    await executeCommand(conn, 'zgrep "14/Jun/2026" /var/log/nginx/access.log.2.gz | grep "POST" || echo "No POST matches on June 14"');
    
    // Also check if there's a backup of data/users.json somewhere on the server
    await executeCommand(conn, 'find / -name "*users*.json" 2>/dev/null || echo "No matches"');
    await executeCommand(conn, 'find / -name "*config.json" 2>/dev/null || echo "No config matches"');
    
    fs.writeFileSync(path.join(__dirname, 'grep_results.txt'), output, 'utf-8');
    console.log('Saved results to grep_results.txt');
    conn.end();
  } catch (error) {
    console.error('Error:', error);
    conn.end();
  }
}).connect(config);
