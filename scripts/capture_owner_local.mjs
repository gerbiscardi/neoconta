import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = "C:\\Users\\Germán Biscardi\\.gemini\\antigravity\\brain\\9318cbe1-3301-42e2-9033-090efbf29988";

const USER_OBJ = {
    id: "admin",
    email: "admin@neoconta.com",
    nombre: "Germán Biscardi",
    role: "owner",
    mustChangePassword: false
};

const TOKEN = jwt.sign(
    { id: USER_OBJ.id, email: USER_OBJ.email, role: USER_OBJ.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureScreen({ width, height, isMobile, filename }) {
    console.log(`Starting capture: ${filename} (${width}x${height})...`);
    const tempDir = path.join(process.cwd(), '.tmp_chrome_owner_' + Date.now() + '_' + Math.floor(Math.random()*1000));
    fs.mkdirSync(tempDir, { recursive: true });

    const port = 9800 + Math.floor(Math.random() * 150);

    const chromeArgs = [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${tempDir}`,
        `--window-size=${width},${height}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--hide-scrollbars'
    ];

    const proc = spawn(CHROME_PATH, chromeArgs);

    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
        await sleep(300);
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json`);
            const targets = await res.json();
            const pageTarget = targets.find(t => t.type === 'page');
            if (pageTarget && pageTarget.webSocketDebuggerUrl) {
                wsUrl = pageTarget.webSocketDebuggerUrl;
                break;
            }
        } catch (e) {}
    }

    if (!wsUrl) {
        proc.kill();
        throw new Error("Could not connect to Chrome port " + port);
    }

    const ws = new WebSocket(wsUrl);
    let msgId = 1;

    const sendCmd = (method, params = {}) => new Promise((resolve, reject) => {
        const id = msgId++;
        const onMsg = (event) => {
            const data = JSON.parse(event.data);
            if (data.id === id) {
                ws.removeEventListener('message', onMsg);
                if (data.error) reject(data.error);
                else resolve(data.result);
            }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id, method, params }));
    });

    await new Promise(resolve => ws.onopen = resolve);

    await sendCmd('Page.enable');
    await sendCmd('Runtime.enable');
    await sendCmd('Network.enable');

    await sendCmd('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: isMobile
    });

    // Set cookie on localhost
    await sendCmd('Network.setCookie', {
        name: 'neoconta_session',
        value: TOKEN,
        url: 'http://localhost:3008',
        domain: 'localhost',
        path: '/',
        secure: false,
        httpOnly: true
    });

    // Now navigate to dashboard
    await sendCmd('Page.navigate', { url: 'http://localhost:3008/dashboard' });
    await sleep(2000);

    await sendCmd('Runtime.evaluate', {
        expression: `localStorage.setItem('neoconta_user', JSON.stringify(${JSON.stringify(USER_OBJ)}));`
    });

    // Reload to ensure localStorage user is detected
    await sendCmd('Page.navigate', { url: 'http://localhost:3008/dashboard' });
    await sleep(5000);

    // Audit computed styles for borders
    const auditResult = await sendCmd('Runtime.evaluate', {
        expression: `
            (() => {
                const elements = Array.from(document.querySelectorAll('*'));
                let countMainDark = 0;
                let countSecDark = 0;
                let countWhiteBorders = 0;
                const borderColors = {};

                elements.forEach(el => {
                    const style = window.getComputedStyle(el);
                    const bc = style.borderColor;
                    if (style.borderWidth !== '0px' && bc) {
                        borderColors[bc] = (borderColors[bc] || 0) + 1;
                        if (bc === 'rgb(36, 48, 65)') countMainDark++;
                        if (bc === 'rgb(30, 41, 59)') countSecDark++;
                        if (bc === 'rgb(241, 245, 249)' || bc === 'rgb(255, 255, 255)') countWhiteBorders++;
                    }
                });

                const pageTitle = document.querySelector('h1')?.innerText || '';
                const mrrText = document.body.innerText.includes('4.750.000');

                return {
                    countMainDark,
                    countSecDark,
                    countWhiteBorders,
                    pageTitle,
                    mrrText,
                    borderColors
                };
            })()
        `,
        returnByValue: true
    });

    console.log(`Audit for ${filename}:`, JSON.stringify(auditResult.result?.value, null, 2));

    const shot = await sendCmd('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false
    });

    const buffer = Buffer.from(shot.data, 'base64');
    const outPath = path.join(ARTIFACTS_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${outPath} (${buffer.length} bytes)`);

    ws.close();
    proc.kill();
    try {
        fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
}

async function main() {
    await captureScreen({
        width: 1440,
        height: 900,
        isMobile: false,
        filename: 'owner_phase1_verified_1440x900.png'
    });

    await captureScreen({
        width: 390,
        height: 844,
        isMobile: true,
        filename: 'owner_phase1_verified_390x844.png'
    });

    console.log("ALL OWNER DASHBOARD SCREENSHOTS COMPLETED!");
}

main().catch(err => {
    console.error("Owner capture failed:", err);
    process.exit(1);
});
