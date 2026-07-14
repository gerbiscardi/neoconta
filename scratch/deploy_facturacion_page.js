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

const localFilePath = path.join(__dirname, '..', 'app', 'dashboard', 'facturacion', 'page.js');
const remoteFilePath = '/var/www/neoconta/app/dashboard/facturacion/page.js';

function uploadFile(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    console.log(`Uploading ${localPath} to ${remotePath}...`);
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      
      const readStream = fs.createReadStream(localPath);
      const writeStream = sftp.createWriteStream(remotePath);
      
      writeStream.on('close', () => {
        console.log('Upload complete.');
        resolve();
      }).on('error', (err) => {
        reject(err);
      });
      
      readStream.pipe(writeStream);
    });
  });
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

conn.on('ready', async () => {
  console.log('SSH connection established to deploy billing page.');
  try {
    // 1. Upload page.js
    await uploadFile(conn, localFilePath, remoteFilePath);

    // 2. Stop PM2 process
    console.log('Stopping PM2 neoconta process...');
    await executeCommand(conn, 'pm2 stop neoconta || true');

    // 3. Remove .next build folder entirely to clear cache and manifest bugs
    console.log('Removing old .next build directory...');
    await executeCommand(conn, 'rm -rf /var/www/neoconta/.next');

    // 4. Start remote build
    console.log('Starting remote build in background with nohup...');
    await executeCommand(conn, 'cd /var/www/neoconta && rm -f build.log && nohup npm run build > build.log 2>&1 &');
    
    console.log('Polling remote build.log status...');
    let finished = false;
    let attempts = 0;
    while (!finished && attempts < 90) {
      await new Promise(r => setTimeout(r, 10000)); // wait 10s
      const logContent = await executeCommand(conn, 'tail -n 25 /var/www/neoconta/build.log || echo "No log yet"');
      console.log(`\n--- [Attempt ${attempts+1}] Log Tail ---`);
      console.log(logContent);
      
      if (logContent.includes('Route (app)') || logContent.includes('prerendered as static content') || (logContent.includes('Compiled successfully') && logContent.includes('Collecting build traces'))) {
        finished = true;
        console.log('Build completed successfully!');
      } else if (logContent.includes('Error:') || logContent.includes('Failed to compile')) {
        console.error('Build failed!');
        conn.end();
        process.exit(1);
      }
      attempts++;
    }

    if (!finished) {
      console.error('Timeout waiting for build.');
      conn.end();
      process.exit(1);
    }

    // 5. Start Next.js under PM2
    console.log('Starting Next.js frontend under PM2...');
    await executeCommand(conn, 'pm2 delete neoconta || true');
    await executeCommand(conn, 'cd /var/www/neoconta && pm2 start npm --name "neoconta" -- start');
    await executeCommand(conn, 'pm2 save');
    
    // 6. Restart Nginx
    console.log('Restarting Nginx...');
    await executeCommand(conn, 'systemctl restart nginx');
    console.log('Billing page deployment completed successfully!');
  } catch (err) {
    console.error('Error during deploy:', err);
  } finally {
    conn.end();
  }
}).connect(config);
