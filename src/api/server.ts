import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { CertificateManager } from '../security/certificate-manager.js';
import { SigningService } from '../security/signing.js';

const { Pool } = pg;

/**
 * KopiAPI — API REST para gestión de certificados y dispositivos.
 * Se despliega en Railway junto con la base de datos PostgreSQL.
 */
export class KopiAPI {
    private app: express.Application;
    private pool: pg.Pool;
    private certManager: CertificateManager;
    private port: number;

    constructor(config: { databaseUrl: string; port?: number }) {
        this.app = express();
        this.port = config.port || 3500;
        this.certManager = new CertificateManager();

        this.pool = new Pool({
            connectionString: config.databaseUrl,
            ssl: { rejectUnauthorized: false },
        });

        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req, _res, next) => {
            console.log(`[Kopi API] ${req.method} ${req.path}`);
            next();
        });
    }

    private setupRoutes(): void {
        const router = express.Router();

        // ─── Health ─────────────────────────────────────────
        router.get('/health', (_req, res) => {
            res.json({ status: 'ok', app: 'Kopi API', version: '1.0.1' });
        });

        // ─── SUNAT Lookup ──────────────────────────────────
        router.get('/ruc/:ruc', async (req, res) => {
            console.log(`[Kopi API] Consulta RUC solicitada: ${req.params.ruc}`);
            try {
                const { ruc } = req.params;
                const token = process.env.APIPERU_TOKEN || '76ca7246c8a8c464fd551b6555e780791a69ff89acb8887558d65b23f05ab81b';

                const apiRes = await fetch('https://apiperu.dev/api/ruc', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ ruc })
                });

                const jsonRes = await apiRes.json() as any;
                if (jsonRes.success && jsonRes.data) {
                    res.json({
                        ruc: jsonRes.data.ruc,
                        nombre: jsonRes.data.nombre_o_razon_social,
                        direccion: jsonRes.data.direccion_completa
                    });
                } else {
                    res.status(404).json({ error: 'RUC no encontrado' });
                }
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        });

        // ─── Empresas ───────────────────────────────────────
        router.get('/empresas', async (_req, res) => {
            try {
                const result = await this.pool.query(
                    'SELECT * FROM empresas WHERE is_active = true ORDER BY nombre'
                );
                res.json(result.rows);
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        });

        router.post('/empresas', async (req, res) => {
            try {
                let { ruc, nombre } = req.body;
                if (!ruc) {
                    return res.status(400).json({ error: 'El RUC es requerido' });
                }

                // Autocompletar nombre usando apiperu.dev si no fue enviado
                if (!nombre) {
                    try {
                        const token = process.env.APIPERU_TOKEN || '76ca7246c8a8c464fd551b6555e780791a69ff89acb8887558d65b23f05ab81b';
                        const apiRes = await fetch('https://apiperu.dev/api/ruc', {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ ruc })
                        });

                        const jsonRes = await apiRes.json() as any;
                        if (jsonRes.success && jsonRes.data && jsonRes.data.nombre_o_razon_social) {
                            nombre = jsonRes.data.nombre_o_razon_social;
                        } else {
                            return res.status(404).json({ error: 'RUC no encontrado en SUNAT' });
                        }
                    } catch (fetchErr) {
                        return res.status(500).json({ error: 'Error al consultar SUNAT: ' + (fetchErr as Error).message });
                    }
                }

                const result = await this.pool.query(
                    'INSERT INTO empresas (ruc, nombre) VALUES ($1, $2) RETURNING *',
                    [ruc, nombre]
                );
                res.status(201).json(result.rows[0]);
            } catch (err: any) {
                if (err.code === '23505') {
                    return res.status(409).json({ error: 'La empresa con ese RUC ya existe' });
                }
                res.status(500).json({ error: err.message });
            }
        });

        // ─── Certificados ───────────────────────────────────
        router.get('/certificates/:empresaId', async (req, res) => {
            try {
                const result = await this.pool.query(
                    `SELECT c.*, e.ruc, e.nombre as empresa_nombre
           FROM certificates c
           JOIN empresas e ON e.id = c.empresa_id
           WHERE e.ruc = $1 AND c.is_active = true
           ORDER BY c.created_at DESC LIMIT 1`,
                    [req.params.empresaId]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'No hay certificados activos para esta empresa' });
                }

                res.json(result.rows[0]);
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        });

        // Obtener solo el certificado digital (para kopi.js setCertificatePromise)
        router.get('/certificates/:empresaId/public', async (req, res) => {
            try {
                const result = await this.pool.query(
                    `SELECT c.digital_certificate
           FROM certificates c
           JOIN empresas e ON e.id = c.empresa_id
           WHERE e.ruc = $1 AND c.is_active = true
           ORDER BY c.created_at DESC LIMIT 1`,
                    [req.params.empresaId]
                );

                if (result.rows.length === 0) {
                    return res.status(404).send('Certificate not found');
                }

                res.type('text/plain').send(result.rows[0].digital_certificate);
            } catch (err: any) {
                res.status(500).send('Error');
            }
        });

        // Generar nuevos certificados para una empresa
        router.post('/certificates/:empresaId/generate', async (req, res) => {
            try {
                const empresaRuc = req.params.empresaId;
                const { validYears } = req.body;

                // Buscar empresa
                const empresa = await this.pool.query(
                    'SELECT * FROM empresas WHERE ruc = $1', [empresaRuc]
                );

                if (empresa.rows.length === 0) {
                    return res.status(404).json({ error: 'Empresa no encontrada' });
                }

                const emp = empresa.rows[0];

                // Generar certificados
                const bundle = await this.certManager.generateForEmpresa(
                    emp.ruc,
                    emp.nombre,
                    validYears || 5
                );

                // Desactivar certificados anteriores
                await this.pool.query(
                    'UPDATE certificates SET is_active = false WHERE empresa_id = $1',
                    [emp.id]
                );

                // Guardar nuevo certificado
                const result = await this.pool.query(
                    `INSERT INTO certificates(empresa_id, digital_certificate, private_key, ca_certificate, expires_at)
           VALUES($1, $2, $3, $4, $5) RETURNING id`,
                    [emp.id, bundle.digitalCertificate, bundle.privateKey, bundle.caCertificate, bundle.expiresAt]
                );

                res.status(201).json({
                    id: result.rows[0].id,
                    empresaId: emp.ruc,
                    empresaNombre: emp.nombre,
                    expiresAt: bundle.expiresAt,
                    files: {
                        certificate: `digital_certificate_${emp.ruc}.txt`,
                        privateKey: `private_certificate_${emp.ruc}.pem`,
                    },
                });
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        });

        // ─── Signing (para kopi.js setSignaturePromise) ─────
        router.get('/sign/:empresaId', async (req, res) => {
            try {
                const request = req.query.request as string;
                if (!request) {
                    return res.status(400).send('Missing request parameter');
                }

                // Obtener clave privada de la empresa
                const result = await this.pool.query(
                    `SELECT c.private_key
           FROM certificates c
           JOIN empresas e ON e.id = c.empresa_id
           WHERE e.ruc = $1 AND c.is_active = true
           ORDER BY c.created_at DESC LIMIT 1`,
                    [req.params.empresaId]
                );

                if (result.rows.length === 0) {
                    return res.status(404).send('No active certificate found');
                }

                const signature = SigningService.signRequest(request, result.rows[0].private_key);
                res.type('text/plain').send(signature);
            } catch (err: any) {
                res.status(500).send('Error signing request');
            }
        });

        // ─── Devices ────────────────────────────────────────
        router.post('/devices/register', async (req, res) => {
            try {
                const { empresaRuc, deviceName, platform, deviceId } = req.body;

                const empresa = await this.pool.query(
                    'SELECT id FROM empresas WHERE ruc = $1', [empresaRuc]
                );

                if (empresa.rows.length === 0) {
                    return res.status(404).json({ error: 'Empresa no encontrada' });
                }

                const result = await this.pool.query(
                    `INSERT INTO devices(empresa_id, device_name, platform, device_id, last_seen)
           VALUES($1, $2, $3, $4, NOW())
           ON CONFLICT(device_id) DO UPDATE SET last_seen = NOW()
           RETURNING * `,
                    [empresa.rows[0].id, deviceName, platform, deviceId]
                );

                res.status(201).json(result.rows[0]);
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        });

        this.app.use('/api', router);
    }

    /**
     * Inicia la API.
     */
    async start(): Promise<void> {
        await this.certManager.initialize();

        // Verificar conexión a DB
        try {
            await this.pool.query('SELECT 1');
            console.log('[Kopi API] ✅ Conectado a PostgreSQL');
        } catch (err) {
            console.error('[Kopi API] ❌ Error conectando a PostgreSQL:', err);
        }

        return new Promise((resolve) => {
            this.app.listen(this.port, '0.0.0.0', () => {
                console.log(`[Kopi API] ✅ API activa en http://0.0.0.0:${this.port}`);
                resolve();
            });
        });
    }
}

// ─── Standalone Mode ────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('[FATAL] DATABASE_URL no está definida. La API no puede iniciar.');
    process.exit(1);
}

const api = new KopiAPI({
    databaseUrl: DATABASE_URL,
    port: parseInt(process.env.PORT || '3500'),
});

api.start().catch(err => {
    console.error('[FATAL] Error arrancando Kopi API:', err);
    process.exit(1);
});
