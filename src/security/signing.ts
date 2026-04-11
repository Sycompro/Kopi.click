import forge from 'node-forge';

/**
 * SigningService — Firma y verifica mensajes con SHA512 + RSA.
 * 
 * Compatible con el flujo de QZ Tray:
 *   1. El servidor envía un challenge (string aleatorio)
 *   2. El cliente firma el challenge con su private key
 *   3. El servidor verifica la firma con el digital certificate
 */
export class SigningService {

    /**
     * Firma un mensaje usando una clave privada RSA.
     * Produce una firma SHA512 codificada en Base64.
     * 
     * @param message - Mensaje a firmar
     * @param privateKeyPem - Clave privada en formato PEM
     * @returns Firma en Base64
     */
    static sign(message: string, privateKeyPem: string): string {
        const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
        const md = forge.md.sha512.create();
        md.update(message, 'utf8');
        const signature = privateKey.sign(md);
        return forge.util.encode64(signature);
    }

    /**
     * Verifica una firma SHA512+RSA usando el certificado público.
     * 
     * @param message - Mensaje original
     * @param signatureBase64 - Firma en Base64
     * @param certificatePem - Certificado digital PEM
     * @returns true si la firma es válida
     */
    static verify(message: string, signatureBase64: string, certificatePem: string): boolean {
        try {
            const cert = forge.pki.certificateFromPem(certificatePem);
            const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
            const md = forge.md.sha512.create();
            md.update(message, 'utf8');
            const signature = forge.util.decode64(signatureBase64);
            return publicKey.verify(md.digest().bytes(), signature);
        } catch {
            return false;
        }
    }

    /**
     * Genera un challenge aleatorio para el proceso de signing.
     */
    static generateChallenge(): string {
        return forge.util.encode64(forge.random.getBytesSync(32));
    }

    /**
     * Endpoint handler: firma un request del navegador.
     * Esto lo usa kopi.js cuando llama a setSignaturePromise.
     * 
     * @param request - String del request a firmar
     * @param privateKeyPem - PEM de la clave privada de la empresa
     * @returns Firma SHA512+RSA en Base64
     */
    static signRequest(request: string, privateKeyPem: string): string {
        return this.sign(request, privateKeyPem);
    }
}
