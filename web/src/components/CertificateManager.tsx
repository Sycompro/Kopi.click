import React, { useState } from 'react';
import { Search, Download, ShieldCheck } from 'lucide-react';

interface CertificateManagerProps {
    lookupRuc: (ruc: string) => Promise<any>;
    generateCert: (id: string, nombre: string, years: number) => Promise<any>;
    exportCertZip: (id: string, nombre: string) => Promise<any>;
}

const CertificateManager: React.FC<CertificateManagerProps> = ({ lookupRuc, generateCert, exportCertZip }) => {
    const [ruc, setRuc] = useState('');
    const [nombre, setNombre] = useState('');
    const [id, setId] = useState('');
    const [years, setYears] = useState(5);
    const [loading, setLoading] = useState(false);

    const handleLookup = async () => {
        if (!ruc) return;
        setLoading(true);
        try {
            const data = await lookupRuc(ruc);
            if (data && data.nombre) {
                setNombre(data.nombre);
                setId(ruc);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!id || !nombre) return;
        await generateCert(id, nombre, years);
        alert('Certificado generado localmente con éxito.');
    };

    const handleExport = async () => {
        if (!id || !nombre) return;
        await exportCertZip(id, nombre);
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Firma Digital & Certificados</h1>
                <p className="page-subtitle">Emisión de certificados industriales con firma SHA512 + RSA 2048.</p>
            </div>

            <div className="card">
                <div className="card-title">Generador de Certificado Empresa</div>
                <div className="card-body">
                    <div className="form-group">
                        <label className="form-label">CONSULTA RUC (SUNAT)</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                className="input"
                                placeholder="Ingrese RUC..."
                                value={ruc}
                                onChange={e => setRuc(e.target.value)}
                            />
                            <button className="btn-action" onClick={handleLookup} disabled={loading}>
                                {loading ? '...' : <Search size={16} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label">ID EMPRESA / RUC</label>
                            <input className="input" value={id} onChange={e => setId(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">VIGENCIA (AÑOS)</label>
                            <input className="input" type="number" value={years} onChange={e => setYears(parseInt(e.target.value))} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">RAZÓN SOCIAL / NOMBRE</label>
                        <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                        <button className="btn-action" onClick={handleGenerate} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldCheck size={16} /> GENERAR FIRMA
                        </button>
                        <button className="btn-action" onClick={handleExport} style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Download size={16} /> EXPORTAR ZIP
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CertificateManager;
