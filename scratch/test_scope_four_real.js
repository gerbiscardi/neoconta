const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '200.58.98.237',
  port: 22,
  username: 'root',
  password: '3/TJwP1VTp5Okv'
};

const scriptCode = `
const { Afip } = require('afip.ts');
const path = require('path');
const fs = require('fs');

async function test() {
  try {
    const userDir = path.join(process.cwd(), 'data', 'users', 'admin');
    const certPath = path.join(userDir, 'cert.crt');
    const keyPath = path.join(userDir, 'private.key');
    const configPath = path.join(userDir, 'config.json');

    const certContent = fs.readFileSync(certPath, 'utf8');
    const keyContent = fs.readFileSync(keyPath, 'utf8');
    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const userCuit = parseInt(userConfig.cuit.replace(/[^0-9]/g, ''));
    const isProduction = userConfig.production === true;

    const afip = new Afip({
      key: keyContent,
      cert: certContent,
      cuit: userCuit,
      production: isProduction,
      ticketPath: path.join(process.cwd(), 'data', 'tickets')
    });

    console.log('Querying ws_sr_padron_a4 (Scope Four) for CUIT: 30518594466...');
    const result = await afip.registerScopeFourService.getTaxpayerDetails(30518594466);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
`;

conn.on('ready', () => {
  console.log('SSH connection established. Running test script on VPS...');
  conn.exec(`node -e ${JSON.stringify(scriptCode)}`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).connect(config);
