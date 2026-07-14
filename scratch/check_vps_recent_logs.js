const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '200.58.98.237',
  port: 22,
  username: 'root',
  password: '3/TJwP1VTp5Okv'
};

conn.on('ready', () => {
  console.log('SSH connection established.');
  // Show the last 100 lines of the access log
  conn.exec('tail -n 100 /var/log/nginx/access.log', (err, stream) => {
    if (err) throw err;
    console.log('--- ACCESS LOGS ---');
    stream.on('close', () => {
      // Show PM2 status and output log tail
      conn.exec('pm2 status && tail -n 50 /root/.pm2/logs/neoconta-error.log', (err2, stream2) => {
        if (err2) throw err2;
        console.log('\n--- PM2 ERRORS ---');
        stream2.on('close', () => {
          conn.end();
        }).on('data', (data) => {
          process.stdout.write(data.toString());
        });
      });
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).connect(config);
