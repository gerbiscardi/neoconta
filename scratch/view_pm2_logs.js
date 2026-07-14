const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '200.58.98.237',
  port: 22,
  username: 'root',
  password: '3/TJwP1VTp5Okv'
};

conn.on('ready', () => {
  console.log('SSH connection established to check logs.');
  conn.exec('tail -n 50 /root/.pm2/logs/neoconta-error.log', (err, stream) => {
    if (err) throw err;
    console.log('--- ERROR LOGS ---');
    stream.on('close', (code, signal) => {
      conn.exec('tail -n 50 /root/.pm2/logs/neoconta-out.log', (err2, stream2) => {
        if (err2) throw err2;
        console.log('\n--- OUTPUT LOGS ---');
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
