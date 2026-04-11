import React from 'react';
import { Activity, Printer, Zap, Clock } from 'lucide-react';

interface DashboardProps {
    serverInfo: any;
    printerCount: number;
}

const Dashboard: React.FC<DashboardProps> = ({ serverInfo, printerCount }) => {
    const stats = [
        { label: 'SESIONES ACTIVAS', value: serverInfo?.connections || 0, icon: Activity, color: '#3b82f6' },
        { label: 'EQUIPOS DISPONIBLES', value: printerCount || 0, icon: Printer, color: '#10b981' },
        { label: 'ESTADO MOTOR', value: serverInfo?.running ? 'LIVE' : 'DOWN', icon: Zap, color: '#f59e0b' },
        { label: 'UPTIME', value: serverInfo?.uptime || '0h 0m', icon: Clock, color: '#8b5cf6' },
    ];

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Panel de Control Industrial</h1>
                <p className="page-subtitle">Monitoreo en tiempo real del motor de impresión y conectividad.</p>
            </div>

            <div className="stats-row">
                {stats.map((s, i) => (
                    <div key={i} className="stat-box">
                        <div className="stat-label" style={{ color: s.color }}>{s.label}</div>
                        <div className="stat-value">{s.value}</div>
                    </div>
                ))}
            </div>

            <div className="card">
                <div className="card-title">Monitor de Conexiones</div>
                <div className="card-body">
                    {serverInfo?.clients && serverInfo.clients.length > 0 ? (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>CLIENTE ID</th>
                                    <th>DIRECCIÓN IP</th>
                                    <th>CONECTADO</th>
                                    <th>ESTADO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {serverInfo.clients.map((c: any) => (
                                    <tr key={c.id}>
                                        <td style={{ fontWeight: 600 }}>{c.id}</td>
                                        <td>{c.ip}</td>
                                        <td>{new Date(c.connectedAt).toLocaleTimeString()}</td>
                                        <td><span className="status-dot online"></span> Activo</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                            Esperando conexiones del navegador...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
