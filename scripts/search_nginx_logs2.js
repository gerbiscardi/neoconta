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
    console.log('\n--- Checking Nginx access logs for admin/users ---');
    await executeCommand(conn, 'grep "admin/users" /var/log/nginx/access.log* || echo "No admin/users matches"');

    console.log('\n--- Checking Nginx access logs for user/config ---');
    await executeCommand(conn, 'grep "user/config" /var/log/nginx/access.log* || echo "No user/config matches"');

    console.log('\n--- Checking Nginx access logs for auth/registro ---');
    await executeCommand(conn, 'grep "auth/registro" /var/log/nginx/access.log* || echo "No auth/registro matches"');

    conn.end();
  } catch (error) {
    console.error('Error:', error);
    conn.end();
  }
}).connect(config);
