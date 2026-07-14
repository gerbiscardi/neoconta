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
  conn.exec('tail -n 40 /var/log/nginx/error.log', (err, stream) => {
    if (err) throw err;
    console.log('--- NGINX ERROR LOGS ---');
    stream.on('close', () => {
      conn.exec('tail -n 40 /var/log/nginx/access.log', (err2, stream2) => {
        if (err2) throw err2;
        console.log('\n--- NGINX ACCESS LOGS ---');
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
