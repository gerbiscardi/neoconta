const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
  host: '200.58.98.237',
  port: 22,
  username: 'root',
  password: '3/TJwP1VTp5Okv'
};

const serperKey = process.argv[2];

if (!serperKey) {
  console.error("Please provide the SERPER_API_KEY as an argument: node update_serper_key.js <key>");
  process.exit(1);
}

function executeCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', (code) => {
        resolve(out);
      }).on('data', (data) => {
        out += data.toString();
      }).stderr.on('data', (data) => {
        out += data.toString();
      });
    });
  });
}

const conn = new Client();
conn.on('ready', async () => {
  console.log('SSH connection established to update Serper API Key.');
  try {
    const file = '/var/www/neoconta/.env.local';
    
    // Check if the file exists
    const checkFile = await executeCommand(conn, `[ -f ${file} ] && echo "exists" || echo "no"`);
    if (checkFile.trim() !== 'exists') {
      console.log('Creating .env.local file...');
      await executeCommand(conn, `echo "SERPER_API_KEY=${serperKey}" > ${file}`);
    } else {
      console.log('Updating SERPER_API_KEY in .env.local...');
      const checkKey = await executeCommand(conn, `grep -q "SERPER_API_KEY=" ${file} && echo "exists" || echo "no"`);
      if (checkKey.trim() === 'exists') {
        // Replace it
        await executeCommand(conn, `sed -i 's/^SERPER_API_KEY=.*/SERPER_API_KEY=${serperKey}/g' ${file}`);
      } else {
        // Append it
        await executeCommand(conn, `echo "SERPER_API_KEY=${serperKey}" >> ${file}`);
      }
    }

    console.log('Verifying key write...');
    const verifyRes = await executeCommand(conn, `grep "SERPER_API_KEY=" ${file}`);
    console.log(verifyRes.trim());

    // Also update local .env.local for consistency
    const localEnvPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(localEnvPath)) {
      let localContent = fs.readFileSync(localEnvPath, 'utf8');
      if (localContent.includes('SERPER_API_KEY=')) {
        localContent = localContent.replace(/^SERPER_API_KEY=.*/m, `SERPER_API_KEY=${serperKey}`);
      } else {
        localContent += `\nSERPER_API_KEY=${serperKey}`;
      }
      fs.writeFileSync(localEnvPath, localContent, 'utf8');
      console.log('Local .env.local updated successfully.');
    }

    console.log('Restarting PM2 neoconta service...');
    await executeCommand(conn, 'pm2 restart neoconta');
    console.log('PM2 restart finished. Serper.dev integration is now active!');

  } catch (err) {
    console.error('Error during Serper key update:', err);
  } finally {
    conn.end();
  }
}).on('error', (err) => {
  console.error('SSH Connection Error:', err);
}).connect(config);
