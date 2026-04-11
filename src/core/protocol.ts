import os from 'os';
import { CertificateManager } from '../security/certificate-manager.js';
import { SigningService } from '../security/signing.js';
import { PrintEngine, type PrintConfig, type PrintResult } from '../printing/print-engine.js';
import type { PrinterInfo } from '../printing/printer-discovery.js';

/**
 * Tipos de mensajes del protocolo Kopi (compatible con QZ Tray).
 */
export interface KopiRequest {
    uid: string;            // ID único del request
    call: string;           // Comando: 'websocket.connect', 'printers.find', 'print', etc.
    params?: any;           // Parámetros del comando
    promise?: string;       // UID de la promesa (para responses)
    signature?: string;     // Firma SHA512 del request
    certificate?: string;   // Certificado digital PEM
}

export interface KopiResponse {
    uid: string;
    promise?: string; // UID de la promesa (para QZ Tray)
    result?: any;   // Para compatibilidad Kopi
    data?: any;     // Para compatibilidad QZ Tray (Mismo contenido que result)
    error?: string;
    timestamp: string;
}

/**
 * ProtocolHandler — Procesa comandos del protocolo WebSocket.
 */
export class ProtocolHandler {
    private printEngine: PrintEngine;
    private certManager: CertificateManager;
    private activeCertificate: string | null = null;
    private isTrusted: boolean = false;
    private port: number;
    private host: string;

    constructor(printEngine: PrintEngine, certManager: CertificateManager, port: number = 8181, host: string = 'localhost') {
        this.printEngine = printEngine;
        this.certManager = certManager;
        this.port = port;
        this.host = host;
    }

    /**
     * Procesa un mensaje recibido por WebSocket.
     */
    async handleMessage(raw: string): Promise<KopiResponse> {
        // Manejar el keep-alive (ping) de QZ Tray que es texto plano
        if (raw === 'ping' || raw === '"ping"') {
            return { uid: 'pong', result: 'pong', timestamp: new Date().toISOString() };
        }

        let request: any;
        try {
            request = JSON.parse(raw);
        } catch (e) {
            return this.errorResponse('unknown', 'Mensaje JSON inválido');
        }

        const uid = request.uid || request.promise || request.UID || request.Promise || 'unknown';

        // Extraer el comando (call) buscando en múltiples variantes de nombres de campo
        let call = request.call || request.action || request.method ||
            request.Call || request.Action || request.Method;

        // Si no está en el nivel superior, buscar dentro de 'data' o 'params' (común en algunas versiones de QZ)
        if (!call && request.data) {
            call = request.data.call || request.data.action || request.data.method;
        }
        if (!call && request.params) {
            call = request.params.call || request.params.action || request.params.method;
        }

        const promise = request.promise || request.uid || request.Promise || request.UID;
        const params = request.params || request.data || request.Params || request.Data || {};

        if (call) call = String(call).trim(); // Limpiar espacios

        console.log(`[Protocol] Request RAW: ${raw.substring(0, 200)}${raw.length > 200 ? '...' : ''}`);
        console.log(`[Protocol] Request Parsed: "${call}" (UID: ${uid}, Promise: ${promise})`);

        // Ignorar heartbeats o mensajes sin comando si tienen UID
        if (!call && uid !== 'unknown') {
            return this.successResponse(uid, { status: 'received' }, promise);
        }

        try {
            switch (call) {
                case 'websocket.connect':
                case 'connect':
                    return this.handleConnect(promise); // Usamos promise como UID para el saludo

                case 'websocket.apiVersion':
                case 'apiVersion':
                case 'websocket.getVersion':
                case 'getVersion':
                    return this.successResponse(uid, '2.2.4', promise);

                case 'websocket.getNetworkInfo':
                case 'getNetworkInfo':
                    return this.handleNetworkInfo(uid, promise);

                case 'security.setCertificate':
                case 'setCertificate':
                    return this.handleSetCertificate(uid, params, promise);

                case 'security.verify':
                case 'verify':
                    return this.handleVerifySignature(uid, params, promise);

                case 'printers.find':
                case 'findPrinters':
                case 'find':
                    return await this.handleFindPrinters(uid, params, promise);

                case 'printers.detail':
                case 'getPrinterDetails':
                case 'detail':
                    return await this.handlePrinterDetail(uid, params, promise);

                case 'printers.getDefault':
                case 'getDefaultPrinter':
                case 'getDefault':
                    return await this.handleGetDefault(uid, promise);

                case 'print':
                case 'printRaw':
                    return await this.handlePrint(uid, params, promise);

                case 'configs.create':
                    return this.handleConfigCreate(uid, params, promise);

                case 'ping':
                    return this.successResponse(uid, { pong: true, version: '1.0.0' }, promise);

                default:
                    const preview = raw.substring(0, 100);
                    return this.errorResponse(uid, `Comando no reconocido: ${call}. RAW: ${preview}...`);
            }
        } catch (err: any) {
            return this.errorResponse(uid, err.message);
        }
    }

    // ─── Handlers ─────────────────────────────────────────────

    private handleConnect(uid: string): KopiResponse {
        return this.successResponse(uid, {
            connected: true,
            version: '2.2.4',
            app: 'QZ Tray', // Crucial: qz.js busca esta identidad exacta
            platform: process.platform,
            arch: process.arch,
            timestamp: new Date().toISOString(),
            allowedIPs: [],
            certStore: 'system',
            trusted: true
        }, uid); // En connect, promise y uid suelen ser lo mismo
    }

    private handleNetworkInfo(uid: string, promise: string): KopiResponse {
        return this.successResponse(uid, {
            hostname: os.hostname(),
            port: 8182,
        }, promise);
    }

    private handleSetCertificate(uid: string, params: any, promise: string): KopiResponse {
        if (!params?.certificate) {
            return this.errorResponse(uid, 'Certificado no proporcionado');
        }

        const certPem = params.certificate;
        const verification = this.certManager.verifyCertificate(certPem);

        if (verification.valid) {
            this.activeCertificate = certPem;
            this.isTrusted = true;
            return this.successResponse(uid, {
                trusted: true,
                subject: verification.subject,
                expiresAt: verification.expiresAt.toISOString(),
            }, promise);
        } else {
            this.activeCertificate = certPem;
            this.isTrusted = false;
            return this.successResponse(uid, {
                trusted: false,
                subject: verification.subject,
                message: 'Certificado no confiable. Se requerirá confirmación.',
            }, promise);
        }
    }

    private handleVerifySignature(uid: string, params: any, promise: string): KopiResponse {
        if (!params?.message || !params?.signature) {
            return this.errorResponse(uid, 'Mensaje o firma faltante');
        }

        if (!this.activeCertificate) {
            return this.errorResponse(uid, 'No hay certificado activo');
        }

        const isValid = SigningService.verify(
            params.message,
            params.signature,
            this.activeCertificate
        );

        return this.successResponse(uid, { valid: isValid }, promise);
    }

    private async handleFindPrinters(uid: string, params: any, promise: string): Promise<KopiResponse> {
        let printers: PrinterInfo[];

        if (params?.query) {
            printers = await this.printEngine.findPrinters(params.query);
        } else {
            printers = await this.printEngine.listPrinters();
        }

        return this.successResponse(uid, printers.map(p => p.name), promise);
    }

    private async handlePrinterDetail(uid: string, params: any, promise: string): Promise<KopiResponse> {
        if (!params?.name) {
            return this.errorResponse(uid, 'Nombre de impresora no proporcionado');
        }

        const printer = await this.printEngine.getPrinterDetails(params.name);
        if (!printer) {
            return this.errorResponse(uid, `Impresora no encontrada: ${params.name}`);
        }

        return this.successResponse(uid, printer, promise);
    }

    private async handleGetDefault(uid: string, promise: string): Promise<KopiResponse> {
        const printers = await this.printEngine.listPrinters();
        const defaultPrinter = printers.find(p => p.isDefault);

        if (defaultPrinter) {
            return this.successResponse(uid, defaultPrinter.name, promise);
        }
        return this.successResponse(uid, null, promise);
    }

    private async handlePrint(uid: string, params: any, promise: string): Promise<KopiResponse> {
        if (!params?.config?.printer && !params?.printer) {
            return this.errorResponse(uid, 'Impresora no especificada');
        }

        if (!params?.data) {
            return this.errorResponse(uid, 'Datos de impresión vacíos');
        }

        const config: PrintConfig = {
            printer: params.config?.printer || params.printer,
            copies: params.config?.copies || params.copies || 1,
        };

        const data = Array.isArray(params.data) ? params.data : [params.data];
        const result: PrintResult = await this.printEngine.print(config, data);

        if (result.success) {
            return this.successResponse(uid, result, promise);
        } else {
            return this.errorResponse(uid, result.error || 'Error de impresión desconocido');
        }
    }

    private handleConfigCreate(uid: string, params: any, promise: string): KopiResponse {
        return this.successResponse(uid, {
            printer: params?.printer || params?.name,
            copies: params?.copies || 1,
            encoding: params?.encoding || 'raw',
        }, promise);
    }

    // ─── Helpers ──────────────────────────────────────────────

    private successResponse(uid: string, result: any, promise?: string): KopiResponse {
        return {
            uid,
            promise,
            result,
            data: result, // Duplicamos en 'data' para compatibilidad con qz.js
            timestamp: new Date().toISOString(),
        };
    }

    private errorResponse(uid: string, error: string): KopiResponse {
        return {
            uid,
            error,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Estado de confianza actual de la conexión.
     */
    get trusted(): boolean {
        return this.isTrusted;
    }
}
