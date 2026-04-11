import React from 'react';
import { LayoutDashboard, ShieldCheck, Printer, FileText } from 'lucide-react';

interface SidebarProps {
    activeSection: string;
    setActiveSection: (section: string) => void;
    serverActive: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, setActiveSection, serverActive }) => {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'certificates', label: 'Certificados', icon: ShieldCheck },
        { id: 'printers', label: 'Impresoras', icon: Printer },
        { id: 'logs', label: 'Actividad', icon: FileText },
    ];

    return (
        <aside className="sidebar">
            <div className="nav-group">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        className={`nav-link ${activeSection === item.id ? 'active' : ''}`}
                        onClick={() => setActiveSection(item.id)}
                    >
                        <item.icon size={18} />
                        <span>{item.label}</span>
                    </button>
                ))}
            </div>

            <div className="sidebar-status">
                <div className="status-row">
                    <span className={`status-dot ${serverActive ? 'online' : ''}`}></span>
                    <span>Port 8182 {serverActive ? 'Activo' : 'Offline'}</span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
