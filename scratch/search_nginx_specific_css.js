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
  conn.exec('grep "21523e0c1a131cf9" /var/log/nginx/access.log || echo "No access logs for this CSS"', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.exec('grep "21523e0c1a131cf9" /var/log/nginx/error.log || echo "No error logs for this CSS"', (err2, stream2) => {
        if (err2) throw err2;
        stream2.on('close', () => {
          conn.end();
        }).on('data', (data) => {
          console.log('--- ERROR LOGS ---');
          console.log(data.toString());
        });
      }).on('data', (data) => {
        console.log('--- ERROR LOGS ---');
        console.log(data.toString());
      });
    }).on('data', (data) => {
      console.log('--- ACCESS LOGS ---');
      console.log(data.toString());
    });
  });
}).connect(config);
