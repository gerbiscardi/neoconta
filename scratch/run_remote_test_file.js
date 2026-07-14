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

const localPath = path.join(__dirname, 'test_a4.js');
const remotePath = '/var/www/neoconta/test_a4.js';

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

conn.on('ready', async () => {
  console.log('SSH connection established.');
  try {
    await uploadFile(conn, localPath, remotePath);
    
    console.log('Executing test file on VPS...');
    conn.exec('node /var/www/neoconta/test_a4.js && rm /var/www/neoconta/test_a4.js', (err, stream) => {
      if (err) throw err;
      stream.on('close', (code, signal) => {
        conn.end();
      }).on('data', (data) => {
        process.stdout.write(data.toString());
      }).stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });
    });
  } catch (error) {
    console.error('Error:', error);
    conn.end();
  }
}).connect(config);
