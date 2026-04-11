import React from 'react';
import { Printer, RefreshCw, Play } from 'lucide-react';

interface PrinterListProps {
    printers: any[];
    refreshPrinters: () => void;
    testPrint: (name: string) => void;
}

const PrinterList: React.FC<PrinterListProps> = ({ printers, refreshPrinters, testPrint }) => {
    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Hardware & Periféricos</h1>
                <p className="page-subtitle">Gestión de dispositivos de impresión local (USB/Red).</p>
            </div>

            <div className="card">
                <div className="card-header">
                    <div className="card-title">IMPRESORAS DETECTADAS</div>
                    <button className="btn-action" onClick={refreshPrinters} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <RefreshCw size={14} /> ACTUALIZAR
                    </button>
                </div>
                <div className="card-body">
                    {printers.length > 0 ? (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>MARCA / MODELO</th>
                                    <th>ESTADO</th>
                                    <th>ACCIÓN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {printers.map((p, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600 }}>
                                            <div style={{ display: 'flex', alignContent: 'center', gap: '8px' }}>
                                                <Printer size={16} color="#64748b" /> {p.name}
                                            </div>
                                        </td>
                                        <td><span className="status-dot online"></span> Operativo</td>
                                        <td>
                                            <button className="btn-action" onClick={() => testPrint(p.name)} style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Play size={12} fill="white" /> PROBAR
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                            No se encontraron impresoras en este equipo.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PrinterList;
