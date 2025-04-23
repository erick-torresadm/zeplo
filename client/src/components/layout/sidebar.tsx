import React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  Smartphone, 
  MessageSquare, 
  BarChart3, 
  ChartBarStacked, 
  LogOut,
  X,
  History,
  Send,
  FileText,
  ListTodo
} from "lucide-react";
import { Logo } from '../ui/logo';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logoutMutation } = useAuth();
  const [location, setLocation] = useLocation();

  const menuItems = [
    {
      icon: <Home size={20} />,
      label: 'Dashboard',
      href: '/dashboard'
    },
    {
      icon: <Smartphone size={20} />,
      label: 'Instâncias WhatsApp',
      href: '/instances'
    },
    {
      icon: <MessageSquare size={20} />,
      label: 'Fluxos de Mensagens',
      href: '/message-flows'
    },
    {
      icon: <ListTodo size={20} />,
      label: 'Fila de Fluxos',
      href: '/flow-queue'
    },
    {
      icon: <History size={20} />,
      label: 'Histórico de Mensagens',
      href: '/message-history'
    },
    {
      icon: <Send size={20} />,
      label: 'Mensagens em Massa',
      href: '/mass-messaging'
    },
    {
      icon: <BarChart3 size={20} />,
      label: 'Analytics',
      href: '/analytics'
    },
    {
      icon: <FileText size={20} />,
      label: 'Logs do Sistema',
      href: '/system-logs'
    }
  ];

  const handleNavigation = (href: string) => {
    setLocation(href);
    onClose();
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 z-40 h-full w-64 transform bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center border-b border-[#E2E8F0] px-6">
          <Logo />
        </div>

        <nav className="space-y-1 px-3 py-4">
          {menuItems.map((item) => (
            <button
              key={item.href}
              onClick={() => handleNavigation(item.href)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                location === item.href
                  ? 'bg-[#F1F5F9] text-[#1E293B]'
                  : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#1E293B]'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* User Menu */}
        {user && (
          <div className="p-4 mx-3 my-4 border border-slate-200 rounded-xl bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 bg-gradient-to-br from-primary-600 to-primary-400 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm">
                  {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-slate-800">{user.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{user.email || 'Usuário'}</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} 
                className="hover:bg-red-50 hover:text-red-500" title="Sair">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
