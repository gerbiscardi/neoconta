const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '200.58.98.237',
  port: 22,
  username: 'root',
  password: '3/TJwP1VTp5Okv'
};

const scriptContent = `
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/var/www/neoconta/data/invoices/cliente_history.json', 'utf8'));
console.log('Total records:', data.length);
const timeGroups = {};
data.forEach(item => {
  const time = item.created_at || 'no_timestamp';
  const prefix = time.slice(0, 16); // e.g. "2026-06-23T18:27"
  timeGroups[prefix] = (timeGroups[prefix] || 0) + 1;
});
console.log('Time distribution:', JSON.stringify(timeGroups, null, 2));
`;

conn.on('ready', () => {
  console.log('SSH connection established.');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const writeStream = sftp.createWriteStream('/tmp/inspect_script.js');
    writeStream.on('close', () => {
      console.log('Uploaded inspect script. Running...');
      conn.exec('node /tmp/inspect_script.js && rm -f /tmp/inspect_script.js', (err2, stream) => {
        if (err2) throw err2;
        stream.on('close', () => {
          conn.end();
        }).on('data', (d) => {
          process.stdout.write(d.toString());
        }).stderr.on('data', (d) => {
          process.stderr.write(d.toString());
        });
      });
    });
    writeStream.write(scriptContent);
    writeStream.end();
  });
}).connect(config);
