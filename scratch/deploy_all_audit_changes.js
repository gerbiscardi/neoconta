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

const filesToUpload = [
  {
    local: path.join(__dirname, '..', 'app', 'dashboard', 'comentor', 'page.js'),
    remote: '/var/www/neoconta/app/dashboard/comentor/page.js'
  },
  {
    local: path.join(__dirname, '..', 'app', 'api', 'ai', 'audit-web', 'route.js'),
    remote: '/var/www/neoconta/app/api/ai/audit-web/route.js'
  },
  {
    local: path.join(__dirname, '..', 'app', 'api', 'ai', 'audit-web', 'recalculate', 'route.js'),
    remote: '/var/www/neoconta/app/api/ai/audit-web/recalculate/route.js'
  }
];

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    console.log(`Uploading ${localPath} to ${remotePath}...`);
    const readStream = fs.createReadStream(localPath);
    const writeStream = sftp.createWriteStream(remotePath);
    
    writeStream.on('close', () => {
      console.log(`Upload complete: ${remotePath}`);
      resolve();
    }).on('error', (err) => {
      reject(err);
    });
    
    readStream.pipe(writeStream);
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
    // Ensure the recalculate directory exists on the VPS
    console.log('Creating directories if needed...');
    await executeCommand(conn, 'mkdir -p /var/www/neoconta/app/api/ai/audit-web/recalculate');

    // SFTP upload all files
    await new Promise((resolve, reject) => {
      conn.sftp(async (err, sftp) => {
        if (err) return reject(err);
        try {
          for (const file of filesToUpload) {
            await uploadFile(sftp, file.local, file.remote);
          }
          resolve();
        } catch (uploadErr) {
          reject(uploadErr);
        }
      });
    });

    // Start remote build
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
