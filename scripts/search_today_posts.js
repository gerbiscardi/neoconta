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
    // Grep all POST requests in the active access.log today (June 16)
    await executeCommand(conn, 'grep "16/Jun/2026" /var/log/nginx/access.log | grep "POST" || echo "No POST matches today"');
    
    // Also cat the contents of data/users.json on the server
    await executeCommand(conn, 'cat /var/www/neoconta/data/users.json || echo "No users.json found"');
    
    // Check if there are directories in data/users
    await executeCommand(conn, 'ls -la /var/www/neoconta/data/users/ || echo "No users folder"');
    
    fs.writeFileSync(path.join(__dirname, 'grep_results.txt'), output, 'utf-8');
    console.log('Saved results to grep_results.txt');
    conn.end();
  } catch (error) {
    console.error('Error:', error);
    conn.end();
  }
}).connect(config);
