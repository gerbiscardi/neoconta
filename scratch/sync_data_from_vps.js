const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const conn = new Client();
const config = {
  host: '200.58.98.237',
  port: 22,
  username: 'root',
  password: '3/TJwP1VTp5Okv'
};

const localZipPath = path.join(__dirname, '..', 'remote_data.zip');
const remoteZipPath = '/root/remote_data.zip';
const localDataDir = path.join(__dirname, '..', 'data');

function executeCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', () => {
        resolve(out);
      }).on('data', (data) => {
        out += data.toString();
      }).stderr.on('data', (data) => {
        out += data.toString();
      });
    });
  });
}

function downloadFile(conn, remotePath, localPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${remotePath} to ${localPath}...`);
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      
      const readStream = sftp.createReadStream(remotePath);
      const writeStream = fs.createWriteStream(localPath);
      
      writeStream.on('close', () => {
        console.log('Download complete.');
        resolve();
      }).on('error', (err) => {
        reject(err);
      });
      
      readStream.pipe(writeStream);
    });
  });
}

conn.on('ready', async () => {
  console.log('SSH connection established.');
  try {
    // 1. Create a zip of remote data directory
    console.log('Zipping remote data directory...');
    await executeCommand(conn, 'zip -r /root/remote_data.zip /var/www/neoconta/data');

    // 2. Download the zip
    await downloadFile(conn, remoteZipPath, localZipPath);

    // 3. Delete remote zip
    console.log('Deleting remote zip file...');
    await executeCommand(conn, 'rm -f /root/remote_data.zip');

    // 4. Extract zip locally
    console.log('Extracting zip locally to overwrite local data...');
    
    // Using PowerShell to expand archive locally
    // Note: the zip contains full path starting from root like var/www/neoconta/data/
    // Let's create a temp extract directory
    const tempExtractDir = path.join(__dirname, '..', 'temp_extract');
    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempExtractDir);
    
    execSync(`powershell -Command "Expand-Archive -Path '${localZipPath}' -DestinationPath '${tempExtractDir}' -Force"`);
    
    // Copy from temp_extract/var/www/neoconta/data/* to localDataDir
    const sourceDataDir = path.join(tempExtractDir, 'var', 'www', 'neoconta', 'data');
    if (fs.existsSync(sourceDataDir)) {
      // Overwrite local data files
      // In node we can just do a cp -rf using powershell
      console.log('Copying synced data to local data directory...');
      execSync(`powershell -Command "Copy-Item -Path '${sourceDataDir}\\*' -Destination '${localDataDir}' -Recurse -Force"`);
      console.log('Sync completed successfully.');
    } else {
      console.error('Could not find var/www/neoconta/data in extracted zip.');
    }
    
    // Clean up local zip and temp dir
    fs.rmSync(localZipPath, { force: true });
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
    console.log('Local temporary files cleaned up.');

  } catch (err) {
    console.error('Error during data sync:', err);
  } finally {
    conn.end();
  }
}).connect(config);
