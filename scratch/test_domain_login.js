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
  conn.exec('curl -i -H "Host: neoconta.com.ar" http://localhost/login', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      const html = data.toString();
      console.log(`Response length: ${html.length}`);
      const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
      if (headMatch) {
        console.log('--- HEAD ---');
        console.log(headMatch[1]);
      } else {
        console.log('First 500 chars:');
        console.log(html.substring(0, 500));
      }
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).connect(config);
