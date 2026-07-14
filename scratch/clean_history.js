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
const filePath = '/var/www/neoconta/data/invoices/cliente_history.json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log('Original count:', data.length);

// Filter out records that are empty mock imports
const cleanedData = data.filter(d => {
  // The original vouchers had real client names and CUITs, not the default "Cliente Importado" and "Servicios BI"
  const isMock = d.RazonSocial === 'Cliente Importado' && d.Concepto === 'Servicios BI' && d.Importe === 1000;
  return !isMock;
});

console.log('Cleaned count:', cleanedData.length);
console.log('Cleaned records:', JSON.stringify(cleanedData, null, 2));

// Save cleaned data
fs.writeFileSync(filePath, JSON.stringify(cleanedData, null, 2));
console.log('History file cleaned and saved!');
`;

conn.on('ready', () => {
  console.log('SSH connection established.');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const writeStream = sftp.createWriteStream('/tmp/clean_script.js');
    writeStream.on('close', () => {
      console.log('Uploaded clean script. Running...');
      conn.exec('node /tmp/clean_script.js && rm -f /tmp/clean_script.js', (err2, stream) => {
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
