import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, Settings, User } from 'lucide-react';

interface UserMenuProps {
  userName: string;
  email?: string;
  userImage?: string;
  onLogout: () => void;
  onSettings: () => void;
  onProfile: () => void;
}

export function UserMenu({ userName, email, userImage, onLogout, onSettings, onProfile }: UserMenuProps) {
  const initials = userName
    .split(' ')
    .map(name => name[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#F1F5F9] transition-colors">
          <div className="relative">
            {userImage ? (
              <img
                src={userImage}
                alt={userName}
                className="w-8 h-8 rounded-full object-cover bg-[#F1F5F9]"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#F1F5F9] flex items-center justify-center">
                <span className="text-sm font-medium text-[#64748B]">{initials}</span>
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-[#22C55E] border-2 border-white rounded-full"></div>
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-[#1E293B] line-clamp-1">{userName}</p>
            <p className="text-xs text-[#64748B]">Online</p>
          </div>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[200px] bg-white rounded-lg shadow-lg border border-[#E2E8F0] py-1 animate-in fade-in-80"
          align="end"
          sideOffset={5}
        >
          <div className="px-3 py-2 border-b border-[#E2E8F0]">
            <p className="text-sm font-medium text-[#1E293B]">{userName}</p>
            {email && <p className="text-xs text-[#64748B]">{email}</p>}
            <p className="text-xs text-[#22C55E] mt-1">Online</p>
          </div>

          <DropdownMenu.Item
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#1E293B] hover:bg-[#F1F5F9] cursor-pointer outline-none"
            onSelect={onProfile}
          >
            <User size={16} className="text-[#64748B]" />
            Perfil
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#1E293B] hover:bg-[#F1F5F9] cursor-pointer outline-none"
            onSelect={onSettings}
          >
            <Settings size={16} className="text-[#64748B]" />
            Configurações
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-px bg-[#E2E8F0] my-1" />

          <DropdownMenu.Item
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer outline-none"
            onSelect={onLogout}
          >
            <LogOut size={16} className="text-red-600" />
            Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
} 