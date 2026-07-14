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

  console.log("CUIT:", cuit);
  console.log("Trying Homologación (production: false)...");

  try {
    const afip = new Afip({
      key: keyContent,
      cert: certContent,
      cuit: cuit,
      production: false
    });

    console.log("Testing electronicBillingService.getLastVoucher(1, 11)...");
    const lastV = await afip.electronicBillingService.getLastVoucher(1, 11);
    console.log("Last voucher:", lastV);

  } catch (err) {
    console.error("Error in Homologación:", err.message);
  }

  console.log("\\nTrying Producción (production: true)...");
  try {
    const afipProd = new Afip({
      key: keyContent,
      cert: certContent,
      cuit: cuit,
      production: true
    });

    console.log("Testing electronicBillingService.getLastVoucher(1, 11) in Production...");
    const lastV = await afipProd.electronicBillingService.getLastVoucher(1, 11);
    console.log("Last voucher (Production):", lastV);

  } catch (err) {
    console.error("Error in Production:", err.message);
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
    // Write test script on the VPS inside the neoconta directory
    console.log('Writing test script on VPS...');
    await executeCommand(conn, `cat << 'EOF' > /var/www/neoconta/scripts/test_afip_diag.js\n${vpsScript}\nEOF`);
    
    // Run the test script on the VPS from the neoconta folder
    console.log('Running test script on VPS...');
    await executeCommand(conn, 'cd /var/www/neoconta && node scripts/test_afip_diag.js');
    
    // Clean up
    await executeCommand(conn, 'rm -f /var/www/neoconta/scripts/test_afip_diag.js');
    
    conn.end();
  } catch (error) {
    console.error('Error:', error);
    conn.end();
  }
}).connect(config);
