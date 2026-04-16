const { app, BrowserWindow, ipcMain, shell, Tray, Menu } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const https = require('https');

let mainWindow;
let tray = null;
let isQuitting = false;
let ws = null;
let isConnected = false;
let sedeId = null;
let token = null;
let tabletsConnected = 0;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 999999; 
let heartbeatTimer = null;

const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'main.log');

function logToDisk(message) {
    const timestamp = new Date().toLocaleString();
    const logEntry = `[${timestamp}] ${message}\n`;
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, logEntry);
    console.log(message);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200, height: 800, minWidth: 800, minHeight: 600,
        webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
        icon: path.join(__dirname, 'icon.ico'),
        title: 'Kopi PRO GOLD Maestro [RAILWAY-FIXED]',
        frame: false, backgroundColor: '#0a0a0f'
    });

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            logToDisk('[App] Ventana oculta en bandeja.');
        }
    });

    let indexPath = app.isPackaged ? path.join(__dirname, 'dist', 'index.html') : path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath).catch(err => logToDisk(`[Maestro] Error HTML: ${err}`));
}

// ═══════════════════════════════════════════════════════════════
// MOTOR DE IMPRESORAS (v2.6.3)
// ═══════════════════════════════════════════════════════════════

function getPrinters() {
    return new Promise((resolve) => {
        if (process.platform === 'win32') {
            exec('wmic printer get Name,Default,DriverName,PortName /format:csv', (error, stdout) => {
                if (error || !stdout) { resolve([]); return; }
                try {
                    const cleanRaw = stdout.replace(/[^\x20-\x7E\r\n]/g, "");
                    const lines = cleanRaw.split(/\r?\n/).filter(line => line.trim().length > 0);
                    const printers = [];
                    const startIdx = (lines.length > 0 && lines[0].toLowerCase().includes('node')) ? 1 : 0;
                    for (let i = startIdx; i < lines.length; i++) {
                        const parts = lines[i].split(',');
                        if (parts.length >= 4 && parts[3].trim()) printers.push(parts[3].trim());
                    }
                    resolve(printers);
                } catch (e) { resolve([]); }
            });
        } else {
            exec("lpstat -p | awk '{print $2}'", (error, stdout) => {
                resolve((stdout || '').split('\n').filter(x => x.trim()));
            });
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// CONEXIÓN A RAILWAY
// ═══════════════════════════════════════════════════════════════

async function connectToRailway(brokerUrl, credentials) {
    if (ws) { ws.close(); ws = null; }
    sedeId = credentials.sedeId;
    token = credentials.token;
    logToDisk(`[Server] Intentando conexión a ${brokerUrl}...`);

    return new Promise((resolve, reject) => {
        try {
            ws = new WebSocket(brokerUrl);
            ws.on('open', () => {
                logToDisk('[Server] ✅ Conexión establecida');
                reconnectAttempts = 0;
                ws.send(JSON.stringify({ action: 'register', sedeId, role: 'pc', token }));
                isConnected = true;
                startHeartbeat();
                if (mainWindow) mainWindow.webContents.send('connection-status', { connected: true });
                resolve({ success: true });
            });
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.status === 'registered') {
                        logToDisk(`[Server] ✅ Sede ${message.sedeId} Registrada`);
                        sendManifest();
                        getPrinters().then(p => sendPrintersList(p));
                    } else if (message.from === 'tablet') {
                        if (message.payload?.type === 'get_printers') getPrinters().then(p => sendPrintersList(p));
                    } else if (message.action === 'tablet_connected') {
                        logToDisk('[Server] 📱 Tablet detectada, sincronizando...');
                        tabletsConnected++;
                        sendManifest();
                        getPrinters().then(p => sendPrintersList(p));
                        if (mainWindow) mainWindow.webContents.send('tablets-connected', { count: tabletsConnected });
                    }
                } catch (e) {}
            });
            ws.on('close', () => {
                isConnected = false;
                stopHeartbeat();
                if (mainWindow) mainWindow.webContents.send('connection-status', { connected: false });
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    logToDisk(`[Server] Desconectado. Reintentando en 3s... (Intento ${reconnectAttempts})`);
                    setTimeout(() => connectToRailway(brokerUrl, { sedeId, token }), 3000);
                }
            });
            ws.on('error', (e) => logToDisk(`[Server] Error: ${e.message}`));
        } catch (error) { reject(error); }
    });
}

function sendManifest() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ action: 'forward', payload: { type: 'entity_manifest', ruc: '12345678901', nombre: os.hostname(), ips: ['127.0.0.1'] } }));
}

function sendPrintersList(printers) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ action: 'forward', payload: { type: 'printers_list', printers } }));
    if (mainWindow) mainWindow.webContents.send('printers-detected', { printers });
}

function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'ping' }));
        }
    }, 10000);
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}

// ═══════════════════════════════════════════════════════════════
// IPC HANDLERS - LOS QUE FALTABAN (v2.6.3)
// ═══════════════════════════════════════════════════════════════

ipcMain.handle('connect-railway', async (event, { brokerUrl, sedeId, token }) => {
    return await connectToRailway(brokerUrl, { sedeId, token });
});

ipcMain.handle('disconnect-railway', () => {
    if (ws) { ws.close(); ws = null; }
    isConnected = false;
    return { success: true };
});

ipcMain.handle('get-printers', async () => {
    const printers = await getPrinters();
    return { printers };
});

ipcMain.handle('get-connection-status', async () => {
    const printers = await getPrinters();
    return { connected: isConnected, tabletsConnected, printers: printers.map(name => ({ name })) };
});

ipcMain.handle('server:lookupRuc', async (event, ruc) => {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ ruc });
        const options = {
            hostname: 'apiperu.dev', port: 443, path: '/api/ruc', method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': 'Bearer 76ca7246c8a8c464fd551b6555e780791a69ff89acb8887558d65b23f05ab81b', 'Content-Length': Buffer.byteLength(postData) }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.success) resolve(result.data); else reject(new Error('No encontrado'));
                } catch (e) { reject(e); }
            });
        });
        req.on('error', (e) => reject(e)); req.write(postData); req.end();
    });
});

ipcMain.handle('railway:load-config', async () => {
    const configPath = path.join(app.getPath('userData'), 'kopi-master-config.json');
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return { brokerUrl: 'wss://broker-websocket-production.up.railway.app', sedeId: '793438', token: 'PXMNGE' };
});

ipcMain.handle('railway:sync-now', async () => {
    sendManifest();
    getPrinters().then(p => sendPrintersList(p));
    return { success: true };
});

function createTray() {
    const iconPath = path.join(__dirname, 'icon.ico');
    tray = new Tray(iconPath);
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Kopi PRO GOLD [INDUSTRIAL]', enabled: false },
        { label: 'Abrir Panel', click: () => mainWindow.show() },
        { label: 'Cerrar', click: () => { isQuitting = true; app.quit(); } }
    ]));
}

app.whenReady().then(() => {
    logToDisk('--- INICIO DE APLICACIÓN KOPI v2.6.3 [RAILWAY-FIXED] ---');
    createWindow(); createTray();
    app.setLoginItemSettings({ openAtLogin: true, path: app.getPath('exe') });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
