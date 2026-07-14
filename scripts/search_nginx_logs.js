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
    console.log('\n--- Checking Nginx access logs for POST requests or user creation ---');
    await executeCommand(conn, 'grep -E "POST|users|registro" /var/log/nginx/access.log* || echo "No matches in active access logs"');

    console.log('\n--- List files in /var/log/nginx/ ---');
    await executeCommand(conn, 'ls -la /var/log/nginx/');

    conn.end();
  } catch (error) {
    console.error('Error:', error);
    conn.end();
  }
}).connect(config);
