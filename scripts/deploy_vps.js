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

function executeCommand(conn, cmd, allowedCodes = [0]) {
  return new Promise((resolve, reject) => {
    console.log(`\nExecuting: ${cmd.split('\n')[0]}...`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      
      let out = '';
      let errOut = '';
      
      stream.on('close', (code, signal) => {
        if (allowedCodes.includes(code)) {
          resolve(out);
        } else {
          reject(new Error(`Command failed with code ${code}. Error: ${errOut}`));
        }
      }).on('data', (data) => {
        out += data.toString();
        process.stdout.write(data.toString());
      }).stderr.on('data', (data) => {
        errOut += data.toString();
        process.stderr.write(data.toString());
      });
    });
  });
}

conn.on('ready', async () => {
  console.log('SSH connection established for deployment.');
  try {
    // 1. Check if python virtual env exists
    const checkEnvCmd = '[ -d /var/www/neoconta/neoconta-ds/prod_env ] && echo "yes" || echo "no"';
    const checkRes = await executeCommand(conn, checkEnvCmd);
    const prodEnvExists = checkRes.trim() === 'yes';
    console.log(`Python virtual environment exists on VPS: ${prodEnvExists}`);

    // 2. Upload Zip
    await uploadFile(conn, localZipPath, remoteZipPath);

    // 2.5 Backup remote data directory
    console.log('Backing up remote data directory...');
    await executeCommand(conn, 'rm -rf /root/neoconta_data_backup && [ -d /var/www/neoconta/data ] && cp -r /var/www/neoconta/data /root/neoconta_data_backup || echo "No existing data to backup"');

    // 3. Clean target directory selectively
    if (prodEnvExists) {
      console.log('Cleaning target directory while preserving python virtual environment, env files and data...');
      await executeCommand(conn, 'find /var/www/neoconta -mindepth 1 -maxdepth 1 ! -name "neoconta-ds" ! -name "data" ! -name ".env*" -exec rm -rf {} +');
      await executeCommand(conn, 'find /var/www/neoconta/neoconta-ds -mindepth 1 -maxdepth 1 ! -name "prod_env" -exec rm -rf {} +');
    } else {
      console.log('Wiping target directory completely...');
      await executeCommand(conn, 'rm -rf /var/www/neoconta/*');
    }

    // 4. Extract Zip
    await executeCommand(conn, `echo "Extracting code bundle..." && unzip -o /root/neoconta_deploy.zip -d /var/www/neoconta/`, [0, 1]);
    await executeCommand(conn, `echo "Removing remote zip file..." && rm /root/neoconta_deploy.zip`);

    // 4.5 Restore remote data directory from backup
    console.log('Restoring remote data directory from backup...');
    await executeCommand(conn, '[ -d /root/neoconta_data_backup ] && cp -rf /root/neoconta_data_backup/* /var/www/neoconta/data/ || echo "No data backup to restore"');

    // 5. Setup Python dependencies if missing
    if (!prodEnvExists) {
      console.log('\nInstalling Python package manager & venv on VPS...');
      await executeCommand(conn, `apt-get update && apt-get install -y python3-pip python3-venv python3-dev`);
      
      const pythonSetupCmds = [
        `echo "Setting up Python Virtual Environment..." && cd /var/www/neoconta/neoconta-ds && python3 -m venv prod_env`,
        `/var/www/neoconta/neoconta-ds/prod_env/bin/pip install --upgrade pip`,
        `echo "Installing Python dependencies (fastapi, uvicorn, prophet, pandas, numpy, scikit-learn, xgboost)... This may take several minutes." && /var/www/neoconta/neoconta-ds/prod_env/bin/pip install fastapi uvicorn pandas numpy prophet scikit-learn xgboost`
      ];
      for (const cmd of pythonSetupCmds) {
        await executeCommand(conn, cmd);
      }
    }

    // 6. Start/Restart Python DS FastAPI Server under PM2
    console.log('\nRestarting Python DS service under PM2...');
    const pm2DsCmds = [
      `pm2 delete neoconta-ds || true`,
      `pm2 start /var/www/neoconta/neoconta-ds/prod_env/bin/python3 --name "neoconta-ds" --cwd "/var/www/neoconta/neoconta-ds" -- -m uvicorn main:app --host 127.0.0.1 --port 8000`,
      `pm2 save`
    ];
    for (const cmd of pm2DsCmds) {
      await executeCommand(conn, cmd);
    }

    // 7. Install NPM packages and Build Next.js frontend
    console.log('\nBuilding Next.js frontend...');
    const buildCommands = [
      `cd /var/www/neoconta && npm install --production=false`,
      `cd /var/www/neoconta && npm run build`
    ];
    for (const cmd of buildCommands) {
      await executeCommand(conn, cmd);
    }

    // 8. Start/Restart Next.js frontend under PM2
    console.log('\nRestarting Next.js frontend under PM2...');
    const pm2WebCmds = [
      `pm2 delete neoconta || true`,
      `cd /var/www/neoconta && pm2 start npm --name "neoconta" -- start`,
      `pm2 save`
    ];
    for (const cmd of pm2WebCmds) {
      await executeCommand(conn, cmd);
    }

    // 9. Configure Nginx
    const nginxConfig = `
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name neoconta.com.ar www.neoconta.com.ar;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api-ds/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
    console.log('Writing Nginx configuration...');
    await executeCommand(conn, `cat << 'EOF' > /etc/nginx/sites-available/neoconta\n${nginxConfig}\nEOF`);
    
    // Enable site and restart Nginx
    const nginxSetup = [
      `ln -sf /etc/nginx/sites-available/neoconta /etc/nginx/sites-enabled/neoconta`,
      `rm -f /etc/nginx/sites-enabled/default`,
      `nginx -t`,
      `systemctl restart nginx`
    ];
    for (const cmd of nginxSetup) {
      await executeCommand(conn, cmd);
    }

    console.log('\nDeployment finished successfully! The site is accessible.');
    conn.end();
  } catch (error) {
    console.error('Error during deployment:', error);
    conn.end();
    process.exit(1);
  }
}).on('error', (err) => {
  console.error('SSH Connection Error:', err);
  process.exit(1);
}).connect(config);

