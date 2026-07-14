const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
const config = {
  host: '200.58.98.237',
  port: 22,
  username: 'root',
  password: '3/TJwP1VTp5Okv'
};

conn.on('ready', () => {
  console.log('SSH connected. Downloading files...');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    const paths = [
      '/var/www/neoconta/data/invoices/rmanuelguerrero_kk8e_history.json'
    ];
    
    paths.forEach(p => {
      const localPath = 'temp_history_inspect.json';
      sftp.fastGet(p, localPath, {}, (downloadErr) => {
        if (downloadErr) {
          console.log(`Failed to download ${p}: ${downloadErr.message}`);
        } else {
          const content = fs.readFileSync(localPath, 'utf-8');
          try {
            const data = JSON.parse(content);
            console.log(`\n=== INSPECTING File: ${p} ===`);
            data.forEach((item, idx) => {
              const cuit = String(item.CUIT || item.Cuit || item.cuit || item.DocNro || "").replace(/[^0-9]/g, "");
              if (cuit.includes("20326277658")) {
                console.log(`\n[${idx}] Entire Record:`);
                console.log(JSON.stringify(item, null, 2));
              }
            });
          } catch (e) {
            console.log(`Error: ${e.message}`);
          }
          fs.unlinkSync(localPath);
        }
        conn.end();
      });
    });
  });
}).connect(config);
