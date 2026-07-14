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
    console.log('\n--- Checking users.json on VPS ---');
    await executeCommand(conn, 'cat /var/www/neoconta/data/users.json');
    console.log('\n--- Checking config.json for rmanuelguerrero_kk8e on VPS ---');
    await executeCommand(conn, 'cat /var/www/neoconta/data/users/rmanuelguerrero_kk8e/config.json || echo "No config.json"');
    
    conn.end();
  } catch (error) {
    console.error('Error:', error);
    conn.end();
  }
}).connect(config);
