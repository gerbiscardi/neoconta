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

const localZipPath = path.join(__dirname, '..', 'neoconta_deploy.zip');
const remoteZipPath = '/root/neoconta_deploy.zip';

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
  console.log('SSH connection established.');
  try {
    // 1. Upload Zip
    await uploadFile(conn, localZipPath, remoteZipPath);

    // 2. Backup remote data directory
    console.log('Backing up remote data directory...');
    await executeCommand(conn, 'rm -rf /root/neoconta_data_backup && [ -d /var/www/neoconta/data ] && cp -r /var/www/neoconta/data /root/neoconta_data_backup || echo "No data to backup"');

    // 3. Selective clean
    console.log('Cleaning target directory selectively...');
    await executeCommand(conn, 'find /var/www/neoconta -mindepth 1 -maxdepth 1 ! -name "neoconta-ds" ! -name "data" ! -name ".env*" -exec rm -rf {} +');
    await executeCommand(conn, 'find /var/www/neoconta/neoconta-ds -mindepth 1 -maxdepth 1 ! -name "prod_env" -exec rm -rf {} +');

    // 4. Extract Zip
    console.log('Extracting zip...');
    await executeCommand(conn, 'unzip -o /root/neoconta_deploy.zip -d /var/www/neoconta/');
    await executeCommand(conn, 'rm -f /root/neoconta_deploy.zip');

    // 5. Restore data directory
    console.log('Restoring data directory...');
    await executeCommand(conn, '[ -d /root/neoconta_data_backup ] && cp -rf /root/neoconta_data_backup/* /var/www/neoconta/data/ || echo "No data backup to restore"');

    // 6. NPM install
    console.log('Installing NPM packages...');
    await executeCommand(conn, 'cd /var/www/neoconta && npm install --production=false');

    // 7. Start remote build in background with nohup
    console.log('Starting remote build in background with nohup...');
    await executeCommand(conn, 'cd /var/www/neoconta && rm -f build.log && nohup npm run build > build.log 2>&1 &');
    
    console.log('Polling build.log status...');
    let finished = false;
    let attempts = 0;
    while (!finished && attempts < 90) {
      await new Promise(r => setTimeout(r, 10000)); // wait 10s
      const logContent = await executeCommand(conn, 'tail -n 25 /var/www/neoconta/build.log || echo "No log yet"');
      console.log(`\n--- [Attempt ${attempts+1}] Log Tail ---`);
      console.log(logContent);
      
      // Check for success output in the log
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

    console.log('Restarting Next.js frontend under PM2...');
    await executeCommand(conn, 'pm2 delete neoconta || true');
    await executeCommand(conn, 'cd /var/www/neoconta && pm2 start npm --name "neoconta" -- start');
    await executeCommand(conn, 'pm2 save');
    
    console.log('Restarting Nginx...');
    await executeCommand(conn, 'systemctl restart nginx');
    console.log('Deployment completed successfully!');
  } catch (err) {
    console.error('Error during deploy:', err);
  } finally {
    conn.end();
  }
}).connect(config);
