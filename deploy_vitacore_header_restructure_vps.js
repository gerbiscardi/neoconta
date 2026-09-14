const { Client } = require('ssh2');
const path = require('path');

const conn = new Client();
const vpsHost = '200.58.98.237';
const vpsUser = 'root';

const filesToUpload = [
    { local: 'app/components/VitacoreHeader.js', remote: '/var/www/neoconta/app/components/VitacoreHeader.js' }
];

conn.on('error', (err) => {
    console.error('SSH Client Error:', err);
});

conn.on('ready', () => {
    console.log('SSH Connection ready.');
    conn.sftp((err, sftp) => {
        if (err) {
            console.error('SFTP Error:', err);
            conn.end();
            process.exit(1);
        }

        let completed = 0;
        filesToUpload.forEach(file => {
            const localPath = path.join(__dirname, file.local);
            const remoteDir = path.dirname(file.remote).replace(/\\/g, '/');
            
            conn.exec(`mkdir -p "${remoteDir}"`, (err) => {
                sftp.fastPut(localPath, file.remote, (err) => {
                    if (err) {
                        console.error(`Error uploading ${file.local}:`, err);
                    } else {
                        console.log(`Uploaded ${file.local} successfully.`);
                    }
                    completed++;
                    if (completed === filesToUpload.length) {
                        console.log('All files uploaded. Rebuilding Next.js app on VPS...');
                        rebuildApp();
                    }
                });
            });
        });
    });
}).connect({
    host: vpsHost,
    port: 22,
    username: vpsUser,
    password: '3/TJwP1VTp5Okv',
    readyTimeout: 30000
});

function rebuildApp() {
    conn.exec('cd /var/www/neoconta && pm2 stop neoconta && rm -rf .next && npm run build && pm2 restart neoconta && systemctl restart nginx', (err, stream) => {
        if (err) {
            console.error('Build error:', err);
            conn.end();
            process.exit(1);
        }
        stream.on('close', (code) => {
            console.log('Deployment completed successfully with exit code:', code);
            conn.end();
            process.exit(0);
        }).on('data', (data) => {
            console.log(data.toString());
        }).stderr.on('data', (data) => {
            console.error(data.toString());
        });
    });
}
