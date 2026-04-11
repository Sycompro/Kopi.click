import React, { useState, useEffect } from 'react';
import { Terminal, Trash2 } from 'lucide-react';

const AuditLog: React.FC = () => {
    const [logs, setLogs] = useState<{ time: string, msg: string, type: string }[]>([]);

    useEffect(() => {
        // Escuchar logs del motor (vía server.log en el bridge o similar)
        // Para v1.2.0 emulamos la persistencia en el componente
        const initialLogs = [
            { time: new Date().toLocaleTimeString(), msg: 'Sincronización Industrial v1.2.0 Activa.', type: 'success' },
            { time: new Date().toLocaleTimeString(), msg: 'Monitoreando puerto 8182...', type: 'info' }
        ];
        setLogs(initialLogs);
    }, []);

    const clearLogs = () => {
        setLogs([]);
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Consola de Auditoría</h1>
                <p className="page-subtitle">Registro cronológico de operaciones y eventos del motor.</p>
            </div>

            <div className="card">
                <div className="card-header">
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Terminal size={16} /> REGISTROS DEL SISTEMA
                    </div>
                    <button className="btn-action" onClick={clearLogs} style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Trash2 size={14} /> LIMPIAR
                    </button>
                </div>
                <div className="log-console">
                    {logs.map((log, i) => (
                        <div key={i} className="log-line">
                            <span className="log-time">[{log.time}]</span>
                            <span className={`log-msg ${log.type}`}>{log.msg}</span>
                        </div>
                    ))}
                    {logs.length === 0 && <div style={{ color: '#475569', textAlign: 'center', marginTop: '20px' }}>No hay registros recientes.</div>}
                </div>
            </div>
        </div>
    );
};

export default AuditLog;
