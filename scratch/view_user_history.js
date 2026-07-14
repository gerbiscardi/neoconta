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
  // Find the history file under /var/www/neoconta/data/invoices/
  conn.exec('ls -la /var/www/neoconta/data/invoices/', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      // Find files and show contents of the history
      conn.exec('cat /var/www/neoconta/data/invoices/*_history.json', (err2, stream2) => {
        if (err2) throw err2;
        stream2.on('close', () => {
          conn.end();
        }).on('data', (data) => {
          console.log('--- HISTORY CONTENTS ---');
          const history = JSON.parse(data.toString());
          console.log(`Total vouchers: ${history.length}`);
          history.forEach((inv, i) => {
            console.log(`[${i+1}] Status: ${inv.status}, Total: ${inv.Total || inv.Importe}, CbteTipo: ${inv.CbteTipo || inv.cbteTipo || inv.afip_response?.response?.FeCabResp?.CbteTipo}`);
          });
        });
      });
    }).on('data', (data) => {
      console.log('--- FILES ---');
      console.log(data.toString());
    });
  });
}).connect(config);
