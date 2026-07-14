const { Client } = require('ssh2');
const conn = new Client();
const config = {
  host: '200.58.98.237',
  port: 22,
  username: 'root',
  password: '3/TJwP1VTp5Okv'
};

function executeCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${cmd}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', (code) => {
        resolve(out);
      }).on('data', (data) => {
        out += data.toString();
        process.stdout.write(data.toString());
      }).stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });
    });
  });
}

conn.on('ready', async () => {
  console.log('Connected to VPS...');
  try {
    console.log('\n--- Searching for any users.json on VPS ---');
    await executeCommand(conn, 'find / -name "users.json" -type f 2>/dev/null');

    console.log('\n--- Searching for "Guerrero" or "Manuel" in PM2 logs ---');
    await executeCommand(conn, 'grep -rnw "/root/.pm2/logs/" -e "Guerrero" -e "Manuel" -e "manuel" 2>/dev/null || echo "No matches in PM2 logs"');

    console.log('\n--- Searching for "Guerrero" or "Manuel" in /var/log/ ---');
    await executeCommand(conn, 'grep -rnw "/var/log/" -e "Guerrero" -e "Manuel" -e "manuel" 2>/dev/null || echo "No matches in /var/log"');

    console.log('\n--- Check PM2 logs directory files ---');
    await executeCommand(conn, 'ls -la /root/.pm2/logs/');

    console.log('\n--- Check if there are other files/folders in /var/www/ ---');
    await executeCommand(conn, 'ls -la /var/www/');

    conn.end();
  } catch (error) {
    console.error('Error:', error);
    conn.end();
  }
}).connect(config);
