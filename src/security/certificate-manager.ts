import forge from 'node-forge';
import fs from 'fs';
import path from 'path';
// @ts-ignore
import archiver from 'archiver';

export interface CertificateBundle {
    digitalCertificate: string;   // PEM del certificado público
    privateKey: string;           // PEM de la clave privada
    caCertificate: string;        // PEM del CA root de Kopi
    empresaId: string;
    expiresAt: Date;
}

export interface CACertificate {
    cert: forge.pki.Certificate;
    key: forge.pki.rsa.PrivateKey;
    pem: string;
}

/**
 * CertificateManager — Genera y gestiona certificados digitales por empresa.
 */
export class CertificateManager {
    private caStore: string;
    private ca: CACertificate | null = null;

    constructor(storePath?: string) {
        this.caStore = storePath || path.join(process.cwd(), 'data', 'ca');
    }

    /**
     * Inicializa o carga la CA root de Kopi.
     */
    async initialize(): Promise<void> {
        const caDir = this.caStore;
        const caCertPath = path.join(caDir, 'kopi-ca.crt');
        const caKeyPath = path.join(caDir, 'kopi-ca.key');

        if (fs.existsSync(caCertPath) && fs.existsSync(caKeyPath)) {
            const certPem = fs.readFileSync(caCertPath, 'utf-8');
            const keyPem = fs.readFileSync(caKeyPath, 'utf-8');
            this.ca = {
                cert: forge.pki.certificateFromPem(certPem),
                key: forge.pki.privateKeyFromPem(keyPem),
                pem: certPem,
            };
            console.log('[Kopi] CA root cargada desde disco');
        } else {
            this.ca = await this.generateCA();
            fs.mkdirSync(caDir, { recursive: true });
            fs.writeFileSync(caCertPath, forge.pki.certificateToPem(this.ca.cert));
            fs.writeFileSync(caKeyPath, forge.pki.privateKeyToPem(this.ca.key));
            console.log('[Kopi] Nueva CA root generada');
        }
    }

    public getCAPath(): string {
        return path.join(this.caStore, 'kopi-ca.crt');
    }

    public getCAPem(): string {
        const caCertPath = this.getCAPath();
        if (fs.existsSync(caCertPath)) {
            return fs.readFileSync(caCertPath, 'utf-8');
        }
        return '';
    }

    private async generateCA(): Promise<CACertificate> {
        const keys = forge.pki.rsa.generateKeyPair(2048);
        const cert = forge.pki.createCertificate();

        cert.publicKey = keys.publicKey;
        cert.serialNumber = this.generateSerial();
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 20);

        const attrs = [
            { name: 'commonName', value: 'Kopi Root CA' },
            { name: 'organizationName', value: 'Kopi Print Solutions' },
            { name: 'countryName', value: 'PE' },
        ];

        cert.setSubject(attrs);
        cert.setIssuer(attrs);

        cert.setExtensions([
            { name: 'basicConstraints', cA: true, critical: true },
            { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
            { name: 'subjectKeyIdentifier' },
        ]);

        cert.sign(keys.privateKey, forge.md.sha256.create());

        return {
            cert,
            key: keys.privateKey,
            pem: forge.pki.certificateToPem(cert),
        };
    }

    async generateForEmpresa(
        empresaId: string,
        empresaNombre: string,
        validYears: number = 5
    ): Promise<CertificateBundle> {
        if (!this.ca) throw new Error('CA no inicializada');

        const keys = forge.pki.rsa.generateKeyPair(2048);
        const cert = forge.pki.createCertificate();

        cert.publicKey = keys.publicKey;
        cert.serialNumber = this.generateSerial();
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + validYears);

        const subjectAttrs = [
            { name: 'commonName', value: `Kopi - ${empresaNombre}` },
            { name: 'organizationName', value: empresaNombre },
            { shortName: 'OU', value: `ID: ${empresaId}` },
            { name: 'countryName', value: 'PE' },
        ];

        cert.setSubject(subjectAttrs);
        cert.setIssuer(this.ca.cert.subject.attributes);

        cert.setExtensions([
            { name: 'basicConstraints', cA: false },
            { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, nonRepudiation: true, critical: true },
            { name: 'extKeyUsage', serverAuth: true, clientAuth: true, codeSigning: true },
            {
                name: 'subjectAltName',
                altNames: [
                    { type: 2, value: 'localhost' },
                    { type: 7, ip: '127.0.0.1' },
                    { type: 2, value: 'localhost.qz.io' }
                ]
            },
            { name: 'subjectKeyIdentifier' },
            { name: 'authorityKeyIdentifier', keyIdentifier: true },
        ]);

        cert.sign(this.ca.key, forge.md.sha256.create());

        return {
            digitalCertificate: forge.pki.certificateToPem(cert),
            privateKey: forge.pki.privateKeyToPem(keys.privateKey),
            caCertificate: this.ca.pem,
            empresaId,
            expiresAt: cert.validity.notAfter,
        };
    }

    async generateServerCertificate(hostnames: string[]): Promise<{ cert: string; key: string }> {
        if (!this.ca) throw new Error('CA no inicializada');

        const keys = forge.pki.rsa.generateKeyPair(2048);
        const cert = forge.pki.createCertificate();

        cert.publicKey = keys.publicKey;
        cert.serialNumber = this.generateSerial();
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

        const attrs = [
            { name: 'commonName', value: hostnames[0] || 'localhost' },
            { name: 'organizationName', value: 'Kopi Local Bridge' },
        ];

        cert.setSubject(attrs);
        cert.setIssuer(this.ca.cert.subject.attributes);

        const altNames = hostnames.map(h => {
            if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return { type: 7, ip: h };
            return { type: 2, value: h };
        });

        if (!hostnames.includes('localhost')) altNames.push({ type: 2, value: 'localhost' });
        if (!hostnames.includes('127.0.0.1')) altNames.push({ type: 7, ip: '127.0.0.1' });
        if (!hostnames.includes('localhost.qz.io')) altNames.push({ type: 2, value: 'localhost.qz.io' });

        cert.setExtensions([
            { name: 'basicConstraints', cA: false },
            { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
            { name: 'extKeyUsage', serverAuth: true, critical: true },
            { name: 'subjectAltName', altNames },
            { name: 'subjectKeyIdentifier' },
            { name: 'authorityKeyIdentifier', keyIdentifier: true },
        ]);

        cert.sign(this.ca.key, forge.md.sha256.create());

        return {
            cert: forge.pki.certificateToPem(cert),
            key: forge.pki.privateKeyToPem(keys.privateKey),
        };
    }

    exportToFiles(bundle: CertificateBundle, outputDir: string): { certPath: string; keyPath: string } {
        fs.mkdirSync(outputDir, { recursive: true });
        const certPath = path.join(outputDir, `digital_certificate_${bundle.empresaId}.txt`);
        const keyPath = path.join(outputDir, `private_certificate_${bundle.empresaId}.pem`);
        fs.writeFileSync(certPath, bundle.digitalCertificate);
        fs.writeFileSync(keyPath, bundle.privateKey);
        return { certPath, keyPath };
    }

    async exportToZip(bundle: CertificateBundle, outputPath: string): Promise<string> {
        const zipPath = outputPath || path.join(process.cwd(), 'data', 'exports', `kopi_certs_${bundle.empresaId}.zip`);
        fs.mkdirSync(path.dirname(zipPath), { recursive: true });

        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });
            output.on('close', () => resolve(zipPath));
            archive.on('error', (err: Error) => reject(err));
            archive.pipe(output);
            archive.append(bundle.digitalCertificate, { name: `digital_certificate_${bundle.empresaId}.txt` });
            archive.append(bundle.privateKey, { name: `private_certificate_${bundle.empresaId}.pem` });
            archive.append(bundle.caCertificate, { name: 'kopi_ca_certificate.crt' });
            archive.finalize();
        });
    }

    verifyCertificate(certPem: string): { valid: boolean; subject: string; expiresAt: Date } {
        if (!this.ca) throw new Error('CA no inicializada');
        try {
            const cert = forge.pki.certificateFromPem(certPem);
            const caStore = forge.pki.createCaStore([this.ca.cert]);
            const verified = forge.pki.verifyCertificateChain(caStore, [cert]);
            const cn = cert.subject.getField('CN');
            return { valid: verified, subject: cn ? cn.value : 'Unknown', expiresAt: cert.validity.notAfter };
        } catch {
            return { valid: false, subject: 'Invalid', expiresAt: new Date(0) };
        }
    }

    getCACertificatePem(): string {
        if (!this.ca) throw new Error('CA no inicializada');
        return this.ca.pem;
    }

    private generateSerial(): string {
        return Date.now().toString(16) + Math.random().toString(16).slice(2, 10);
    }
}
