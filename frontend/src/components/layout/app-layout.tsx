import { useState } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./sidebar";
import { MobileHeader } from "./mobile-header";
import KeywordAlertCorner from "../notifications/keyword-alert";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  
  // Verifica se estamos na página de fila de fluxos
  const isFlowQueuePage = location === "/flow-queue" || location === "/fila-de-fluxos";

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#1E293B]">
      {/* Exibe o Header apenas se não estiver na página de fila de fluxos */}
      {!isFlowQueuePage && (
        <MobileHeader onOpenSidebar={() => setSidebarOpen(true)} />
      )}
      
      <div className="flex flex-1">
        {/* Apenas renderiza a Sidebar se não for a página de fila de fluxos */}
        {!isFlowQueuePage && (
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}
        
        <main className="flex-1 bg-[#F8FAFC]">
          <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
      
      {/* Componente de alertas no canto da tela */}
      <KeywordAlertCorner />
    </div>
  );
}