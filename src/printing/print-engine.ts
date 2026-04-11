import { PrinterDiscovery, type PrinterInfo } from './printer-discovery.js';
import { USBPrinter } from './usb-printer.js';
import { NetworkPrinter } from './network-printer.js';

export interface PrintConfig {
    printer: string;          // Nombre de la impresora
    copies?: number;          // Número de copias (default: 1)
    encoding?: string;        // Encoding de los datos (default: 'raw')
}

export interface PrintResult {
    success: boolean;
    printer: string;
    connectionType: string;
    bytesWritten: number;
    timestamp: string;
    error?: string;
}

/**
 * PrintEngine — Orquestador central de impresión.
 * Decide automáticamente si usar USB o red basado en la impresora.
 */
export class PrintEngine {
    private discovery: PrinterDiscovery;
    private usbPrinter: USBPrinter;
    private networkPrinter: NetworkPrinter;
    private printerCache: Map<string, PrinterInfo> = new Map();
    private customNetworkPrinters: Map<string, { ip: string; port: number }> = new Map();

    constructor() {
        this.discovery = new PrinterDiscovery();
        this.usbPrinter = new USBPrinter();
        this.networkPrinter = new NetworkPrinter();
    }

    /**
     * Lista todas las impresoras disponibles.
     */
    async listPrinters(): Promise<PrinterInfo[]> {
        const printers = await this.discovery.findAll();
        // Actualizar cache
        this.printerCache.clear();
        for (const p of printers) {
            this.printerCache.set(p.name, p);
        }
        return printers;
    }

    /**
     * Busca impresoras por nombre.
     */
    async findPrinters(query: string): Promise<PrinterInfo[]> {
        return this.discovery.find(query);
    }

    /**
     * Obtiene detalles de una impresora específica.
     */
    async getPrinterDetails(name: string): Promise<PrinterInfo | null> {
        if (this.printerCache.has(name)) return this.printerCache.get(name)!;
        const found = await this.discovery.find(name);
        return found.length > 0 ? found[0] : null;
    }

    /**
     * Registra una impresora de red manualmente (IP + puerto).
     */
    registerNetworkPrinter(name: string, ip: string, port: number = 9100): void {
        this.customNetworkPrinters.set(name, { ip, port });
        console.log(`[Kopi] Impresora de red registrada: ${name} → ${ip}:${port}`);
    }

    /**
     * Imprime datos raw a una impresora.
     * Detecta automáticamente si es USB o red y usa el método apropiado.
     * 
     * @param config - Configuración de impresión
     * @param data - Datos raw (ESC/POS, ZPL, texto, etc.)
     */
    async print(config: PrintConfig, data: Array<string | Buffer | Record<string, any>>): Promise<PrintResult> {
        const copies = config.copies || 1;
        const printerName = config.printer;

        // Concatenar todos los datos en un solo buffer
        const buffers: Buffer[] = [];
        for (const item of data) {
            if (Buffer.isBuffer(item)) {
                buffers.push(item);
            } else if (typeof item === 'string') {
                buffers.push(Buffer.from(item, 'binary'));
            } else if (typeof item === 'object' && item !== null) {
                // Soporte para objetos con tipo y datos (formato QZ Tray)
                const obj = item as Record<string, any>;
                if (obj.type === 'raw' && obj.data) {
                    buffers.push(Buffer.from(obj.data, obj.format || 'plain'));
                } else if (obj.type === 'base64' && obj.data) {
                    buffers.push(Buffer.from(obj.data, 'base64'));
                } else if (obj.type === 'hex' && obj.data) {
                    buffers.push(Buffer.from(obj.data, 'hex'));
                } else {
                    buffers.push(Buffer.from(JSON.stringify(obj)));
                }
            }
        }

        const combinedData = Buffer.concat(buffers);
        let connectionType = 'unknown';

        try {
            for (let i = 0; i < copies; i++) {
                // ¿Es una impresora de red registrada manualmente?
                const customNet = this.customNetworkPrinters.get(printerName);
                if (customNet) {
                    connectionType = 'network';
                    await this.networkPrinter.printRaw(customNet.ip, combinedData, customNet.port);
                    continue;
                }

                // Buscar en la cache/sistema
                let printerInfo = this.printerCache.get(printerName);
                if (!printerInfo) {
                    const found = await this.discovery.find(printerName);
                    printerInfo = found.length > 0 ? found[0] : undefined;
                }

                if (printerInfo) {
                    connectionType = printerInfo.connectionType;

                    if (printerInfo.connectionType === 'network' && printerInfo.ipAddress) {
                        await this.networkPrinter.printRaw(
                            printerInfo.ipAddress,
                            combinedData,
                            printerInfo.port || 9100
                        );
                    } else {
                        // USB o tipo desconocido → intentar por nombre (raw spooler)
                        await this.usbPrinter.printRaw(printerInfo.name, combinedData);
                    }
                } else {
                    // Impresora no encontrada en el sistema, intentar raw por nombre
                    connectionType = 'usb';
                    await this.usbPrinter.printRaw(printerName, combinedData);
                }
            }

            return {
                success: true,
                printer: printerName,
                connectionType,
                bytesWritten: combinedData.length * copies,
                timestamp: new Date().toISOString(),
            };
        } catch (err: any) {
            return {
                success: false,
                printer: printerName,
                connectionType,
                bytesWritten: 0,
                timestamp: new Date().toISOString(),
                error: err.message,
            };
        }
    }
}
