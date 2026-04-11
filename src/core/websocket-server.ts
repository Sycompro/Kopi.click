import { WebSocketServer, WebSocket } from 'ws';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import { ProtocolHandler } from './protocol.js';
import { PrintEngine } from '../printing/print-engine.js';
import { CertificateManager } from '../security/certificate-manager.js';

export interface ServerConfig {
    port: number;
    host: string;
    useTLS: boolean;
    certPath?: string;
    keyPath?: string;
}

export interface ClientConnection {
    id: string;
    ws: WebSocket;
    ip: string;
    connectedAt: Date;
    trusted: boolean;
    empresa?: string;
}

/**
 * KopiServer — Servidor WebSocket principal de Kopi.
 * 
 * Escucha conexiones del navegador en ws://localhost:8182 (o wss://)
 * y procesa comandos de impresión, descubrimiento de impresoras,
 * y gestión de certificados.
 */
export class KopiServer {
    private wss: WebSocketServer | null = null;
    private server: http.Server | https.Server | null = null;
    private config: ServerConfig;
    private connections: Map<string, ClientConnection> = new Map();
    private printEngine: PrintEngine;
    private certManager: CertificateManager;
    private handlers: Map<string, ProtocolHandler> = new Map();

    // Event callbacks
    public onConnection?: (client: ClientConnection) => void;
    public onDisconnection?: (clientId: string) => void;
    public onMessage?: (clientId: string, message: string) => void;
    public onError?: (error: Error) => void;

    constructor(config?: Partial<ServerConfig>) {
        this.config = {
            port: config?.port || 8182,
            host: config?.host || '127.0.0.1',
            useTLS: config?.useTLS || false,
            certPath: config?.certPath,
            keyPath: config?.keyPath,
        };

        this.printEngine = new PrintEngine();
        this.certManager = new CertificateManager();
    }

    /**
     * Inicia el servidor WebSocket de Kopi.
     * Escanea puertos 8181-8484 si es necesario.
     */
    async start(): Promise<void> {
        await this.certManager.initialize();

        const ports = [8181, 8282, 8383, 8484];
        let started = false;

        for (const port of ports) {
            try {
                await this.tryStart(port);
                this.config.port = port;
                started = true;
                break;
            } catch (err: any) {
                console.warn(`[Kopi] Puerto ${port} ocupado o no disponible, intentando siguiente...`);
            }
        }

        if (!started) {
            throw new Error('No se pudo iniciar el servidor en ningún puerto del rango 8181-8484');
        }
    }

    private async tryStart(port: number): Promise<void> {
        console.log(`[Kopi] Intentando iniciar en puerto ${port}...`);
        
        // Generar certificado TLS firmado por CA para este puerto/host
        const hostnames = ['localhost', '127.0.0.1', 'localhost.qz.io'];
        try {
            const { getLocalIP } = await import('../utils/network.js');
            const ip = getLocalIP();
            if (ip) hostnames.push(ip);
        } catch { /* ignore */ }

        console.log(`[Kopi] Generando certificado TLS para: ${hostnames.join(', ')}`);
        const { cert, key } = await this.certManager.generateServerCertificate(hostnames);

        const tlsDir = path.join(process.cwd(), 'data', 'tls');
        fs.mkdirSync(tlsDir, { recursive: true });
        fs.writeFileSync(path.join(tlsDir, 'server.crt'), cert);
        fs.writeFileSync(path.join(tlsDir, 'server.key'), key);
        console.log(`[Kopi] Certificados guardados en: ${tlsDir}`);

        if (this.config.useTLS) {
            this.server = https.createServer({ cert, key });
            this.server.on('tlsClientError', (err, socket) => {
                console.error(`[Kopi] ⚠️ Error TLS: ${err.message}`);
                this.onError?.(err);
            });
        } else {
            this.server = http.createServer();
        }

        this.wss = new WebSocketServer({
            server: this.server,
            handleProtocols: (protocols) => {
                const requested = Array.from(protocols);
                return requested.includes('qz') ? 'qz' : (requested[0] || false);
            }
        });

        this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
        this.wss.on('error', (err) => {
            console.error(`[Kopi] Error en WebSocketServer:`, err);
            this.onError?.(err);
        });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout al iniciar servidor en puerto ${port}`));
            }, 5000);

            this.server!.listen(port, this.config.host, () => {
                clearTimeout(timeout);
                const protocol = this.config.useTLS ? 'wss' : 'ws';
                console.log(`[Kopi] ✅ Servidor activo en ${protocol}://${this.config.host}:${port}`);
                resolve();
            });
            
            this.server!.on('error', (err: any) => {
                clearTimeout(timeout);
                console.error(`[Kopi] ❌ Error en puerto ${port}:`, err.message);
                this.onError?.(err);
                reject(err);
            });
        });
    }

    /**
     * Detiene el servidor.
     */
    async stop(): Promise<void> {
        // Cerrar todas las conexiones
        for (const [id, conn] of this.connections) {
            conn.ws.close(1000, 'Servidor detenido');
            this.connections.delete(id);
        }

        // Cerrar WebSocket server
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }

        // Cerrar HTTP server
        if (this.server) {
            return new Promise((resolve) => {
                this.server!.close(() => {
                    console.log('[Kopi] Servidor detenido');
                    resolve();
                });
            });
        }
    }

    /**
     * Maneja una nueva conexión WebSocket.
     */
    private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
        const clientId = this.generateClientId();
        const ip = req.socket.remoteAddress || 'unknown';

        // Crear handler de protocolo para esta conexión pasándole puerto e IP activa
        const localIP = (req.socket.localAddress === '::1' || req.socket.localAddress === '127.0.0.1')
            ? 'localhost'
            : (req.socket.localAddress?.split(':').pop() || 'localhost'); // Extraer IPv4 de IPv6-mapped

        const handler = new ProtocolHandler(this.printEngine, this.certManager, this.config.port, localIP);

        const client: ClientConnection = {
            id: clientId,
            ws,
            ip,
            connectedAt: new Date(),
            trusted: false,
        };

        this.connections.set(clientId, client);
        this.handlers.set(clientId, handler);

        console.log(`[Kopi] 🔗 Cliente conectado: ${clientId} desde ${ip}`);
        this.onConnection?.(client);

        // Mensaje de bienvenida oficial para QZ Tray
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'server',
                version: '2.2.4'
            }));
        }

        // Heartbeat
        const heartbeat = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            }
        }, 30000);

        ws.on('message', async (rawData) => {
            const message = rawData.toString();
            this.onMessage?.(clientId, message);

            try {
                const response = await handler.handleMessage(message);

                // Actualizar estado de confianza
                client.trusted = handler.trusted;

                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(response));
                }
            } catch (err: any) {
                console.error(`[Kopi] Error procesando mensaje de ${clientId}:`, err);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        uid: 'error',
                        error: err.message,
                        timestamp: new Date().toISOString(),
                    }));
                }
            }
        });

        ws.on('close', (code, reason) => {
            clearInterval(heartbeat);
            this.connections.delete(clientId);
            this.handlers.delete(clientId);
            console.log(`[Kopi] ❌ Cliente desconectado: ${clientId} (código: ${code})`);
            this.onDisconnection?.(clientId);
        });

        ws.on('error', (err) => {
            console.error(`[Kopi] Error en cliente ${clientId}:`, err);
        });
    }


    private generateClientId(): string {
        return `kopi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // ─── Getters ──────────────────────────────────────────────

    get port(): number { return this.config.port; }
    get activeConnections(): number { return this.connections.size; }
    get isRunning(): boolean { return this.wss !== null; }

    getConnections(): ClientConnection[] {
        return Array.from(this.connections.values());
    }

    getCertificateManager(): CertificateManager {
        return this.certManager;
    }

    getPrintEngine(): PrintEngine {
        return this.printEngine;
    }
}
