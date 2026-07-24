const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '200.58.98.237',
    port: 22,
    username: 'root',
    password: process.env.VPS_PASSWORD || '3/TJwP1VTp5Okv',
    readyTimeout: 30000
};

const localRoot = __dirname;
const remoteRoot = '/var/www/neoconta';

const filesToUpload = [
    'app/api/vitacore/prescriptions/route.js',
    'app/api/vitacore/prescriptions/validate/route.js',
    'app/api/vitacore/professionals/route.js',
    'app/components/SignatureCanvas.js',
    'app/lib/generatePrescriptionPDF.js',
    'app/validar-receta/[id]/page.js',
    'app/dashboard/vitacore/[id]/page.js'
];

console.log('Connecting to VPS SSH (200.58.98.237)...');
const conn = new Client();

conn.on('ready', () => {
    console.log('SSH Connection established successfully!');
    conn.sftp((err, sftp) => {
        if (err) throw err;

        let completed = 0;
        filesToUpload.forEach(relPath => {
            const localFile = path.join(localRoot, relPath);
            const remoteFile = path.join(remoteRoot, relPath);
            const remoteDir = path.dirname(remoteFile);

            conn.exec(`mkdir -p ${remoteDir}`, (err) => {
                if (err) console.error(err);
                console.log(`Uploading ${localFile} to ${remoteFile}...`);
                sftp.fastPut(localFile, remoteFile, (err) => {
                    if (err) {
                        console.error(`Error uploading ${relPath}:`, err);
                    } else {
                        console.log(`Uploaded ${relPath} successfully.`);
                    }
                    completed++;
                    if (completed === filesToUpload.length) {
                        triggerBuild(conn);
                    }
                });
            });
        });
    });
});

conn.on('error', (err) => {
    console.error(`SSH Connection error:`, err.message);
    process.exit(1);
});

conn.connect(config);

function triggerBuild(conn) {
    console.log('All files uploaded. Rebuilding Next.js app on VPS...');
    const cmd = `cd /var/www/neoconta && pm2 stop neoconta && rm -rf .next/cache && nohup npm run build > build.log 2>&1 &`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('Build triggered in background. Polling build status...');
            pollBuildStatus(conn);
        });
    });
}

function pollBuildStatus(conn, attempts = 0) {
    if (attempts > 35) {
        console.error('Build timeout.');
        conn.end();
        return;
    }

    setTimeout(() => {
        conn.exec('tail -n 35 /var/www/neoconta/build.log', (err, stream) => {
            if (err) throw err;
            let output = '';
            stream.on('data', data => output += data.toString());
            stream.on('close', () => {
                console.log(`--- [Attempt ${attempts + 1}] Log Tail ---`);
                console.log(output);

                if (output.includes('Build completed successfully!') || output.includes('✓ Generating static pages') || output.includes('Finalizing page optimization')) {
                    console.log('Build completed successfully!');
                    restartServices(conn);
                } else if (output.includes('Build failed') || output.includes('Failed to compile')) {
                    console.error('Build failed on server!');
                    conn.end();
                } else {
                    pollBuildStatus(conn, attempts + 1);
                }
            });
        });
    }, 4000);
}

function restartServices(conn) {
    console.log('Starting Next.js frontend under PM2...');
    conn.exec('cd /var/www/neoconta && pm2 start npm --name "neoconta" -- start && systemctl restart nginx', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('Deployment completed successfully!');
            conn.end();
        });
    });
}
