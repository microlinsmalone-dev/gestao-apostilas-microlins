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
            src="/images/microlins-icon.png"
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
