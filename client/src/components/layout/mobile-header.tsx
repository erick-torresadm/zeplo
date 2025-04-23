import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface MobileHeaderProps {
  onOpenSidebar: () => void;
}

export function MobileHeader({ onOpenSidebar }: MobileHeaderProps) {
  const { user } = useAuth();
  
  return (
    <div className="lg:hidden bg-white border-b border-slate-200">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={onOpenSidebar} className="text-slate-600 hover:text-primary-600">
            <Menu className="h-6 w-6" />
          </Button>
          <div className="flex items-center">
            <span className="font-bold text-xl text-primary-600">WhatsFlow</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
              {user?.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
