'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FilePlus,
  ClipboardList,
  History,
  GraduationCap,
  Settings,
  CalendarClock
} from 'lucide-react';

// Ícone oficial estilizado "M" da Microlins incorporado em Base64
const MICROLINS_ICON_BASE64 = "data:image/png;base64,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";

const menuItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Novo Pedido', href: '/nova-ordem', icon: FilePlus },
  { label: 'Previsão de Apostilas', href: '/nova-ordem?tab=forecast', icon: CalendarClock },
  { label: 'Pedido Manual', href: '/novo-pedido-manual', icon: ClipboardList },
  { label: 'Histórico', href: '/historico', icon: History },
  { label: 'Educadores', href: '/configuracoes/educadores', icon: GraduationCap },
  { label: 'Configurações', href: '/configuracoes', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="no-print w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <img
            src={MICROLINS_ICON_BASE64}
            alt="Microlins"
            className="w-10 h-10 rounded-lg shadow-md object-contain shrink-0"
          />
          <div>
            <h1 className="font-bold text-base tracking-wide text-white">Microlins</h1>
            <p className="text-xs text-slate-400 font-medium">Gestão de Apostilas</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#0f3b7d] text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
        Sistema Web v2.0 • Supabase
      </div>
    </aside>
  );
}
