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
        if (code === 0) resolve(out);
        else reject(new Error(`Exit code ${code}`));
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
  console.log('Connected to fix PM2 Python startup.');
  try {
    await executeCommand(conn, 'pm2 delete neoconta-ds || true');
    // Start using python3 binary directly to avoid PM2 JavaScript parser error
    await executeCommand(conn, 'pm2 start /var/www/neoconta/neoconta-ds/prod_env/bin/python3 --name "neoconta-ds" --cwd "/var/www/neoconta/neoconta-ds" -- -m uvicorn main:app --host 127.0.0.1 --port 8000');
    await executeCommand(conn, 'pm2 save');
    
    // Wait a couple of seconds and check status
    console.log('Waiting 3s for service initialization...');
    await new Promise(r => setTimeout(r, 3000));
    
    await executeCommand(conn, 'pm2 status');
    conn.end();
  } catch (error) {
    console.error('Error:', error);
    conn.end();
  }
}).connect(config);
