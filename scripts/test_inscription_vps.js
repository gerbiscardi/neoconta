const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const config = {
  host: '200.58.98.237',
  port: 22,
  username: 'root',
  password: '3/TJwP1VTp5Okv'
};

const vpsScript = `
const { Afip } = require('afip.ts');
const fs = require('fs');
const path = require('path');

async function run() {
  const userDir = '/var/www/neoconta/data/users/rmanuelguerrero_kk8e';
  const certPath = path.join(userDir, 'cert.crt');
  const keyPath = path.join(userDir, 'private.key');
  const configPath = path.join(userDir, 'config.json');

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath) || !fs.existsSync(configPath)) {
    console.error("Missing config or cert files");
    return;
  }

  const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const cuit = parseInt(userConfig.cuit.replace(/[^0-9]/g, ''));
  const certContent = fs.readFileSync(certPath, 'utf8');
  const keyContent = fs.readFileSync(keyPath, 'utf8');

  console.log("Initializing AFIP for user rmanuelguerrero_kk8e (production: true)...");
  
  const afip = new Afip({
    key: keyContent,
    cert: certContent,
    cuit: cuit,
    production: true,
    ticketPath: '/var/www/neoconta/data/tickets'
  });

  const targetCuit = 20347467228;
  console.log("Querying Inscription Proof for CUIT:", targetCuit);
  try {
    const details = await afip.registerInscriptionProofService.getTaxpayerDetails(targetCuit);
    console.log("Success! Inscription Proof Result:");
    console.log(JSON.stringify(details, null, 2));
  } catch (err) {
    console.error("Error for Inscription Proof:", err.message);
  }
}

run();
`;

function executeCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', (code) => {
        resolve(out);
      }).on('data', (data) => {
        out += data.toString();
        process.stdout.write(data.toString());
      }).stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });
    });
  });
}

conn.on('ready', async () => {
  console.log('Connected to VPS...');
  try {
    console.log('Writing test script on VPS...');
    await executeCommand(conn, `cat << 'EOF' > /var/www/neoconta/scripts/tmp_test_insc.js\n${vpsScript}\nEOF`);
    
    console.log('Running test script on VPS...');
    await executeCommand(conn, 'cd /var/www/neoconta && node scripts/tmp_test_insc.js');
    
    console.log('Cleaning up...');
    await executeCommand(conn, 'rm -f /var/www/neoconta/scripts/tmp_test_insc.js');
    
    conn.end();
  } catch (error) {
    console.error('Error:', error);
    conn.end();
  }
}).connect(config);
