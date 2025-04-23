import { useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileHeader } from "./mobile-header";
import KeywordAlertCorner from "../notifications/keyword-alert";
import { useLocation } from "wouter";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  
  // Verifica se estamos na página de fila de fluxos
  const isFlowQueuePage = location === "/flow-queue" || location === "/fila-de-fluxos";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Exibe o Header apenas se não estiver na página de fila de fluxos */}
      {!isFlowQueuePage && (
        <MobileHeader onOpenSidebar={() => setSidebarOpen(true)} />
      )}
      
      <div className="flex flex-1">
        {/* Apenas renderiza a Sidebar se não for a página de fila de fluxos */}
        {!isFlowQueuePage && (
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}
        
        <main className="flex-1 bg-slate-50">
          {children}
        </main>
      </div>
      
      {/* Componente de alertas no canto da tela */}
      <KeywordAlertCorner />
    </div>
  );
}