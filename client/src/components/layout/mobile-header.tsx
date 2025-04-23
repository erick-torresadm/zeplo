import React from 'react';
import { Menu } from 'lucide-react';
import { Logo } from '../ui/logo';
import { UserMenu } from '../ui/user-menu';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';

interface MobileHeaderProps {
  onOpenSidebar: () => void;
}

export function MobileHeader({ onOpenSidebar }: MobileHeaderProps) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      setLocation('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleSettings = () => {
    setLocation('/configuracoes');
  };

  const handleProfile = () => {
    setLocation('/perfil');
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-[#E2E8F0] bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      <button
        onClick={onOpenSidebar}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[#F1F5F9] lg:hidden"
      >
        <Menu className="h-6 w-6 text-[#64748B]" />
      </button>

      <div className="flex flex-1 items-center gap-4">
        <Logo />
        
        <div className="flex flex-1 items-center justify-end">
          <UserMenu
            userName={user.name}
            email={user.email}
            userImage={user.avatarUrl || undefined}
            onLogout={handleLogout}
            onSettings={handleSettings}
            onProfile={handleProfile}
          />
        </div>
      </div>
    </header>
  );
}
