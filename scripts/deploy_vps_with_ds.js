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
  console.log('SSH connection established for Python DS & Next.js deployment.');
  try {
    // 1. Upload ZIP code bundle
    await uploadFile(conn, localZipPath, remoteZipPath);

    // 2. Unzip code on server
    await executeCommand(conn, `echo "Cleaning target directory /var/www/neoconta..." && rm -rf /var/www/neoconta/*`);
    await executeCommand(conn, `echo "Extracting code bundle..." && unzip -o /root/neoconta_deploy.zip -d /var/www/neoconta/`, [0, 1]);
    await executeCommand(conn, `echo "Removing remote zip file..." && rm /root/neoconta_deploy.zip`);

    // 3. Setup Python dependencies (pip, venv, dev)
    console.log('\nInstalling Python package manager & venv on VPS...');
    await executeCommand(conn, `apt-get install -y python3-pip python3-venv python3-dev`);

    // 4. Create Python virtual environment and install packages
    const pythonSetupCmds = [
      `echo "Setting up Python Virtual Environment..." && cd /var/www/neoconta/neoconta-ds && python3 -m venv prod_env`,
      `/var/www/neoconta/neoconta-ds/prod_env/bin/pip install --upgrade pip`,
      `echo "Installing Python dependencies (fastapi, uvicorn, prophet, pandas, numpy, scikit-learn, xgboost)... This might take a moment." && /var/www/neoconta/neoconta-ds/prod_env/bin/pip install fastapi uvicorn pandas numpy prophet scikit-learn xgboost`
    ];
    for (const cmd of pythonSetupCmds) {
      await executeCommand(conn, cmd);
    }

    // 5. Start Python DS FastAPI Server under PM2
    const pm2DsCmds = [
      `echo "Starting Python DS microservice under PM2..." && pm2 delete neoconta-ds || true`,
      `pm2 start /var/www/neoconta/neoconta-ds/prod_env/bin/uvicorn --name "neoconta-ds" --cwd "/var/www/neoconta/neoconta-ds" -- main:app --host 127.0.0.1 --port 8000`,
      `pm2 save`
    ];
    for (const cmd of pm2DsCmds) {
      await executeCommand(conn, cmd);
    }

    // 6. Install NPM packages and build Next.js frontend
    const buildCommands = [
      `echo "Installing Next.js dependencies on server..." && cd /var/www/neoconta && npm install --production=false`,
      `echo "Building Next.js application..." && cd /var/www/neoconta && npm run build`
    ];
    for (const cmd of buildCommands) {
      await executeCommand(conn, cmd);
    }

    // 7. Start/Restart Next.js frontend under PM2
    const pm2WebCmds = [
      `echo "Starting Next.js frontend under PM2..." && pm2 delete neoconta || true`,
      `cd /var/www/neoconta && pm2 start npm --name "neoconta" -- start`,
      `pm2 save`
    ];
    for (const cmd of pm2WebCmds) {
      await executeCommand(conn, cmd);
    }

    // 8. Configure Nginx with Next.js and Python DS API proxying
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

    console.log('\nDeployment of Next.js and Python DS microservice finished successfully!');
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
