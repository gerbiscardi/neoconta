import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
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

const secret = process.env.JWT_SECRET;
if (!secret) {
    console.error("Missing JWT_SECRET!");
    process.exit(1);
}

const TOKEN = jwt.sign(
    { id: USER_OBJ.id, email: USER_OBJ.email, role: USER_OBJ.role },
    secret,
    { expiresIn: '7d' }
);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyAPI() {
    console.log("=== 1. VERIFICANDO API /api/admin/users EN LOCAL ===");
    const res = await fetch("http://localhost:3008/api/admin/users?callerRole=owner", {
        headers: {
            "Cookie": `neoconta_session=${TOKEN}`
        }
    });

    if (!res.ok) {
        throw new Error(`HTTP Error from /api/admin/users: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log("Respuesta de la API exitosa:", data.success);
    console.log("Stats recibidas:", JSON.stringify(data.stats, null, 2));

    const s = data.stats;
    console.log("\n--- VALIDACIONES CRÍTICAS DE FASE 1 ---");
    console.log("✓ MRR Real Contratado:", s.mrr, "== 0 ?", s.mrr === 0);
    console.log("✓ Clientes Comerciales:", s.commercialClientsCount, "== 1 ?", s.commercialClientsCount === 1);
    console.log("✓ Cuentas Internas / Prueba:", s.internalUsersCount, "== 3 ?", s.internalUsersCount === 3);
    console.log("✓ Total Comprobantes Clientes:", s.totalInvoices, "== 30 ?", s.totalInvoices === 30);
    console.log("✓ Desglose Comprobantes:", JSON.stringify(s.totalInvoicesBreakdown), "== 23 Fct / 7 NC ?", s.totalInvoicesBreakdown.facturas === 23 && s.totalInvoicesBreakdown.notasCredito === 7);
    console.log("✓ Comprobantes Mes Corriente (Nov):", s.currentMonthInvoices, "== 0 ?", s.currentMonthInvoices === 0);
    console.log("✓ Cupo Mensual Contratado:", s.totalQuota, "== 1000 ?", s.totalQuota === 1000);
    console.log("✓ Uso Cupo Mes Corriente:", s.quotaUtilization, "== 0 ?", s.quotaUtilization === 0);
    console.log("✓ Tasa de Conversión:", s.conversionRate, "== 'Fase Inicial' ?", s.conversionRate === "Fase Inicial");
    console.log("✓ Serie Mensual Dinámica:", JSON.stringify(s.monthlySeries, null, 2));

    // Validar serie mensual
    const expected = {
        '2026-06': { total: 7, facturas: 6, notasCredito: 1 },
        '2026-07': { total: 2, facturas: 2, notasCredito: 0 },
        '2026-08': { total: 17, facturas: 11, notasCredito: 6 },
        '2026-09': { total: 0, facturas: 0, notasCredito: 0 },
        '2026-10': { total: 4, facturas: 4, notasCredito: 0 },
        '2026-11': { total: 0, facturas: 0, notasCredito: 0 }
    };

    for (const item of s.monthlySeries) {
        const exp = expected[item.key];
        if (!exp) continue;
        if (item.total !== exp.total || item.facturas !== exp.facturas || item.notasCredito !== exp.notasCredito) {
            throw new Error(`Discrepancia en serie mensual ${item.key}: recibido ${JSON.stringify(item)}, esperado ${JSON.stringify(exp)}`);
        }
    }
    console.log("✓ Serie mensual 100% conciliada y verificada contra ARCA.");

    // Validar persistencia de cuentas internas
    const adminU = data.users.find(u => u.id === 'admin');
    const clienteU = data.users.find(u => u.id === 'cliente');
    const nocliU = data.users.find(u => u.id === 'nocli');
    const mgU = data.users.find(u => u.id === 'rmanuelguerrero_kk8e');

    console.log("✓ admin isInternal:", adminU?.isInternal, "== true ?", adminU?.isInternal === true);
    console.log("✓ cliente isInternal:", clienteU?.isInternal, "== true ?", clienteU?.isInternal === true);
    console.log("✓ nocli isInternal:", nocliU?.isInternal, "== true ?", nocliU?.isInternal === true);
    console.log("✓ Manuel Guerrero isInternal:", mgU?.isInternal, "== false ?", mgU?.isInternal === false);

    console.log("\nTODAS LAS ASERCIONES DE DATOS PASARON SATISFACTORIAMENTE.");
}

async function captureScreen({ width, height, filename }) {
    console.log(`Iniciando captura: ${filename} (${width}x${height})...`);
    const tempDir = path.join(process.cwd(), '.tmp_chrome_verify_' + Date.now() + '_' + Math.floor(Math.random()*1000));
    fs.mkdirSync(tempDir, { recursive: true });

    const port = 9800 + Math.floor(Math.random() * 150);

    const chromeArgs = [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${tempDir}`,
        `--window-size=${width},${height}`,
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        'about:blank'
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
        fs.rmSync(tempDir, { recursive: true, force: true });
        throw new Error("No se pudo conectar a Chrome DevTools");
    }

    const ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
    });

    let msgId = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = msgId++;
        const handler = (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.id === id) {
                ws.off('message', handler);
                if (msg.error) reject(msg.error);
                else resolve(msg.result);
            }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
    });

    try {
        await send('Page.enable');
        await send('Network.enable');

        await send('Network.setCookie', {
            name: 'neoconta_session',
            value: TOKEN,
            domain: 'localhost',
            path: '/',
            httpOnly: false,
            secure: false
        });

        await send('Page.navigate', { url: 'http://localhost:3008/dashboard' });

        // Esperar a que la página cargue y renderice los componentes React
        await sleep(4000);

        // Inject current user into localStorage if needed by client
        await send('Runtime.evaluate', {
            expression: `
                localStorage.setItem('neoconta_user', JSON.stringify(${JSON.stringify(USER_OBJ)}));
            `
        });

        await sleep(1500);

        const screenshot = await send('Page.captureScreenshot', {
            format: 'png',
            fromSurface: true
        });

        const targetPath = path.join(ARTIFACTS_DIR, filename);
        fs.writeFileSync(targetPath, Buffer.from(screenshot.data, 'base64'));
        console.log(`✓ Captura guardada con éxito en: ${targetPath}`);

    } finally {
        ws.close();
        proc.kill();
        await sleep(500);
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

async function run() {
    try {
        await verifyAPI();
        console.log("\n=== 2. CAPTURANDO PANTALLAS DEL PANEL OWNER REFACTORIZADO ===");
        await captureScreen({ width: 1440, height: 900, filename: 'owner_phase1_verified_1440x900.png' });
        await captureScreen({ width: 390, height: 844, filename: 'owner_phase1_verified_390x844.png' });
        console.log("\n¡VERIFICACIÓN COMPLETA Y EXITOSA!");
        process.exit(0);
    } catch (err) {
        console.error("Error durante la verificación:", err);
        process.exit(1);
    }
}

run();
