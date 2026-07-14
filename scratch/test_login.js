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
  
  // Curl command to test login via localhost:3000
  const cmdLocal = `curl -i -s -X POST -H "Content-Type: application/json" -d '{"email":"admin@neoconta.com","password":"admin123"}' http://localhost:3000/api/auth/login`;
  
  // Curl command to test login via public domain
  const cmdPublic = `curl -i -s -X POST -H "Content-Type: application/json" -d '{"email":"admin@neoconta.com","password":"admin123"}' http://200.58.98.237/api/auth/login`;
  
  console.log('--- LOCALHOST:3000 ---');
  conn.exec(cmdLocal, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      console.log('\n--- PUBLIC IP ---');
      conn.exec(cmdPublic, (err2, stream2) => {
        if (err2) throw err2;
        stream2.on('close', () => {
          conn.end();
        }).on('data', (data) => {
          process.stdout.write(data.toString());
        });
      });
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    });
  });
}).connect(config);
