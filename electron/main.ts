import { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell, nativeImage } from 'electron';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { KopiServer } from '../src/core/websocket-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logger Profesional a Disco (Silencioso en Producción)
const LOG_FILE = path.join(app.getPath('desktop'), 'kopi_main.log');
function logToDisk(msg: string) {
    try {
        const timestamp = new Date().toISOString();
        fs.appendFileSync(LOG_FILE, `[${timestamp}] ${msg}\n`);
    } catch (e) {
        console.error('No se pudo escribir log a disco', e);
    }
}

logToDisk('--- INICIO DE APLICACIÓN KOPI v1.4.2 PRO ---');
process.on('uncaughtException', (err) => logToDisk('FATAL: ' + (err instanceof Error ? err.stack : err)));

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let server: KopiServer | null = null;
let isQuitting = false;

let currentServerPort = 8181;

/**
 * Inicia el servidor WebSocket de Kopi.
 */
async function startServer(): Promise<void> {
    try {
        server = new KopiServer({
            port: currentServerPort,
            host: '127.0.0.1',  // Cambiar a localhost primero para evitar problemas de firewall
            useTLS: true,
        });
        logToDisk('[Server] Intentando iniciar servidor WebSocket...');

    // Eventos del servidor
    server.onConnection = (client) => {
        logToDisk(`[Server] Cliente conectado: ${client.id} desde ${client.ip}`);
        mainWindow?.webContents.send('server:connection', {
            id: client.id,
            ip: client.ip,
            time: client.connectedAt.toISOString(),
        });
        updateTrayTooltip();
    };

    server.onDisconnection = (clientId) => {
        logToDisk(`[Server] Cliente desconectado: ${clientId}`);
        mainWindow?.webContents.send('server:disconnection', { id: clientId });
        updateTrayTooltip();
    };

    server.onMessage = (clientId, message) => {
        logToDisk(`[WebSocket Message] ${clientId}: ${message}`);
        mainWindow?.webContents.send('server:message', { clientId, message });
    };

    server.onError = (error) => {
        logToDisk(`[Server ERROR] ${error.message}\n${error.stack}`);
    };

    logToDisk('[Server] Iniciando servidor...');
    await server.start();
    logToDisk(`[Server] Servidor iniciado exitosamente en puerto ${server.port}`);

    // Auto-confianza del certificado (v1.4.1)
    const certManager = server.getCertificateManager();
    const caPath = certManager.getCAPath();
    if (fs.existsSync(caPath)) {
        logToDisk(`TRUST: Intentando confiar en CA mediante PowerShell: ${caPath}`);
        // Usar PowerShell para una instalación más robusta en el almacén de raíces de confianza
        const psCommand = `powershell -Command "Import-Certificate -FilePath '${caPath}' -CertStoreLocation 'Cert:\\LocalMachine\\Root'"`;
        exec(psCommand, (err, stdout, stderr) => {
            if (err) {
                logToDisk(`ERROR TRUST PS: ${err.message}`);
                // Fallback a certutil por si acaso
                exec(`certutil -addstore -f root "${caPath}"`);
            } else {
                logToDisk(`SUCCESS TRUST PS: ${stdout}`);
                mainWindow?.webContents.send('server:trusted', true);
            }
        });
    }

    currentServerPort = server.port;
    const localIP = getLocalIPs()[0];
    logToDisk(`[Server] Acceso LAN disponible en wss://${localIP}:${currentServerPort}`);
    console.log(`[Kopi] 🌐 Acceso LAN disponible en wss://${localIP}:${currentServerPort}`);
    mainWindow?.webContents.send('server:started', { port: currentServerPort, localIP });
    } catch (error: any) {
        logToDisk(`[Server FATAL] Error al iniciar servidor: ${error.message}\n${error.stack}`);
        console.error('[Kopi] Error fatal al iniciar servidor:', error);
        
        // Notificar al renderer del error
        mainWindow?.webContents.send('server:error', { 
            message: error.message,
            port: currentServerPort 
        });
        
        throw error;
    }
}

/**
 * Detecta todas las IPs locales de la máquina (WiFi, Ethernet, etc).
 */
function getLocalIPs(): string[] {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address);
            }
        }
    }
    return addresses.length > 0 ? addresses : ['127.0.0.1'];
}

/**
 * Crea la ventana principal.
 */
function createWindow(): void {
    const preloadPath = path.join(__dirname, 'preload.cjs');
    logToDisk(`Cargando Preload: ${preloadPath} (Existe: ${fs.existsSync(preloadPath)})`);

    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        minWidth: 900,
        minHeight: 600,
        title: 'Kopi — Panel de Control',
        icon: getIconPath(),
        show: false,
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#0a0a0f',
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        },
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });
}

/**
 * Crea el icono de la bandeja del sistema.
 */
function createTray(): void {
    const iconPath = getIconPath();
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);

    updateTrayMenu();
    updateTrayTooltip();

    tray.on('double-click', () => {
        mainWindow?.show();
        mainWindow?.focus();
    });
}

function updateTrayMenu(): void {
    const connections = server?.activeConnections || 0;
    const menu = Menu.buildFromTemplate([
        { label: 'Kopi v1.4.2 PRO', enabled: false },
        { type: 'separator' },
        { label: `Estado: ${server?.isRunning ? '🟢 Activo' : '🔴 Detenido'}`, enabled: false },
        { label: `Conexiones: ${connections}`, enabled: false },
        { type: 'separator' },
        { label: 'Abrir Panel de Control', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
        { label: 'Reiniciar Servidor', click: async () => { await server?.stop(); await startServer(); updateTrayMenu(); } },
        { type: 'separator' },
        { label: 'Salir de Kopi', click: () => { isQuitting = true; server?.stop().then(() => app.quit()); } },
    ]);
    tray?.setContextMenu(menu);
}

function updateTrayTooltip(): void {
    const connections = server?.activeConnections || 0;
    tray?.setToolTip(`Kopi — ${connections} conexión(es) activa(s)\nPuerto: ${currentServerPort}`);
    updateTrayMenu();
}

function getIconPath(): string {
    return path.join(__dirname, '..', 'assets', 'logo.png');
}

// ─── IPC Handlers ─────────────────────────────────────────

function setupIPC(): void {
    // Generar certificados
    ipcMain.handle('certificates:generate', async (_event, data: any) => {
        const certManager = server?.getCertificateManager();
        if (!certManager) throw new Error('Servidor no iniciado');

        const bundle = await certManager.generateForEmpresa(data.empresaId, data.empresaNombre, data.validYears || 5);

        // Exportar automáticamente al escritorio
        const desktopPath = path.join(os.homedir(), 'Desktop', 'KOPI_FIRMAS');
        const paths = certManager.exportToFiles(bundle, desktopPath);

        // Abrir la carpeta para que el usuario la vea
        shell.openPath(desktopPath);

        return {
            bundle,
            folder: desktopPath,
            files: paths
        };
    });

    // Exportar como ZIP
    ipcMain.handle('certificates:exportZip', async (_event, data: any) => {
        const certManager = server?.getCertificateManager();
        if (!certManager) throw new Error('Servidor no iniciado');
        const bundle = await certManager.generateForEmpresa(data.empresaId, data.empresaNombre, data.validYears || 5);
        const result = await dialog.showSaveDialog(mainWindow!, {
            defaultPath: `kopi_certs_${data.empresaId}.zip`,
            filters: [{ name: 'ZIP', extensions: ['zip'] }],
        });
        if (result.canceled || !result.filePath) return null;
        return await certManager.exportToZip(bundle, result.filePath);
    });

    // Listar impresoras
    ipcMain.handle('printers:list', async () => {
        const engine = server?.getPrintEngine();
        return engine?.listPrinters() || [];
    });

    // Imprimir prueba
    ipcMain.handle('printers:test', async (_event, printerName: string) => {
        const engine = server?.getPrintEngine();
        if (!engine) throw new Error('Servidor no iniciado');

        // v1.2.4: Test Universal (Texto plano + Form Feed) para compatibilidad HP/Epson/Thermal
        const testData = [
            '----------------------------------------\r\n',
            '       KOPI INDUSTRIAL v1.2.4 PRO       \r\n',
            '----------------------------------------\r\n',
            `IMPRESORA: ${printerName}\r\n`,
            `FECHA: ${new Date().toLocaleString()}\r\n`,
            'ESTADO: COMUNICACION SPOOLER EXITOSA\r\n',
            'SISTEMA: ARQUITECTURA ZERO-BUILD ACTIVE\r\n',
            '----------------------------------------\r\n',
            '\r\n\r\n',
            '\x0C' // Form Feed para impresoras de oficina (Láser/Inkjet)
        ];
        return engine.print({ printer: printerName }, testData);
    });

    // Estado del servidor
    ipcMain.handle('server:status', () => {
        const ips = getLocalIPs();
        return {
            running: server?.isRunning || false,
            port: currentServerPort,
            connections: server?.activeConnections || 0,
            localIP: ips[0], // IP principal
            allIPs: ips,     // Todas las IPs para el dashboard
            clients: server?.getConnections().map(c => ({ id: c.id, ip: c.ip, connectedAt: c.connectedAt.toISOString(), trusted: c.trusted })) || [],
        };
    });

    // Búsqueda de RUC (IPC Seguro)
    ipcMain.handle('server:lookupRuc', async (_event, ruc: string) => {
        try {
            logToDisk(`CONSULTA SUNAT: ${ruc}`);
            const response = await fetch(`https://kopi-api-production.up.railway.app/api/ruc/${ruc}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            logToDisk(`RESULTADO: ${(data as any).nombre || 'No encontrado'}`);
            return data;
        } catch (err: any) {
            logToDisk(`ERROR RUC: ${err.message}`);
            throw err;
        }
    });

    ipcMain.on('server:log', (_event, msg) => logToDisk('[Renderer] ' + msg));
    ipcMain.on('window:minimize', () => mainWindow?.minimize());
    ipcMain.on('window:maximize', () => { mainWindow?.isMaximized() ? mainWindow?.unmaximize() : mainWindow?.maximize(); });
    ipcMain.on('window:close', () => mainWindow?.hide());
    ipcMain.on('window:openExternal', (_event, url) => shell.openExternal(url));
}

// ─── App Lifecycle ──────────────────────────────────────────

app.whenReady().then(async () => {
    setupIPC();
    createWindow();
    createTray();
    await startServer();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => { });
app.on('before-quit', async () => { isQuitting = true; await server?.stop(); });
