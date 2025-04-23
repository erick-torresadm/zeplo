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

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { 
      name: "Dashboard", 
      path: "/", 
      icon: <Home className="h-5 w-5 mr-3" />  
    },
    { 
      name: "Instâncias WhatsApp", 
      path: "/instances", 
      icon: <Smartphone className="h-5 w-5 mr-3" /> 
    },
    { 
      name: "Fluxos de Mensagens", 
      path: "/message-flows", 
      icon: <MessageSquare className="h-5 w-5 mr-3" /> 
    },
    { 
      name: "Fila de Fluxos", 
      path: "/flow-queue", 
      icon: <ListTodo className="h-5 w-5 mr-3" /> 
    },
    { 
      name: "Histórico de Mensagens", 
      path: "/message-history", 
      icon: <History className="h-5 w-5 mr-3" /> 
    },
    { 
      name: "Mensagens em Massa", 
      path: "/mass-messaging", 
      icon: <Send className="h-5 w-5 mr-3" /> 
    },
    { 
      name: "Analytics", 
      path: "/analytics", 
      icon: <BarChart3 className="h-5 w-5 mr-3" /> 
    },
    { 
      name: "Relatórios", 
      path: "/reports", 
      icon: <ChartBarStacked className="h-5 w-5 mr-3" /> 
    },
    { 
      name: "Logs do Sistema", 
      path: "/system-logs", 
      icon: <FileText className="h-5 w-5 mr-3" /> 
    }
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-72 shadow-lg bg-white transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-auto ${
      open ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-between p-5 bg-primary-50">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <span className="text-gradient font-bold text-xl">WhatsFlow</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-600 hover:text-primary-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto pt-4">
          <nav className="px-3 space-y-2">
            {navItems.map(item => (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={location === item.path ? "secondary" : "ghost"}
                  className={`w-full justify-start rounded-lg py-6 ${
                    location === item.path 
                      ? 'bg-primary-50 text-primary-600 font-medium shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.icon}
                  {item.name}
                </Button>
              </Link>
            ))}
          </nav>
        </div>

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
    </div>
  );
}
