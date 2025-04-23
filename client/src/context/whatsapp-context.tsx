import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Instance } from "@shared/schema";
import { useWhatsAppInstances } from "@/hooks/use-whatsapp-instances";

// Definição do contexto
interface WhatsAppContextType {
  instances: Instance[];
  connectedInstances: Instance[];
  isLoading: boolean;
  error: Error | null;
  hasConnectedInstances: boolean;
  selectedInstanceId: string;
  setSelectedInstanceId: (id: string) => void;
  selectedInstance: Instance | undefined;
  refetchInstances: () => void;
}

// Criação do contexto
const WhatsAppContext = createContext<WhatsAppContextType | undefined>(undefined);

// Provedor do contexto
export function WhatsAppProvider({ children }: { children: ReactNode }) {
  const {
    instances,
    connectedInstances,
    isLoading,
    error,
    hasConnectedInstances,
    selectedInstanceId,
    setSelectedInstanceId,
    selectedInstance,
    refetch: refetchInstances
  } = useWhatsAppInstances();

  return (
    <WhatsAppContext.Provider
      value={{
        instances,
        connectedInstances,
        isLoading,
        error,
        hasConnectedInstances,
        selectedInstanceId,
        setSelectedInstanceId,
        selectedInstance,
        refetchInstances
      }}
    >
      {children}
    </WhatsAppContext.Provider>
  );
}

// Hook personalizado para usar o contexto
export function useWhatsAppContext() {
  const context = useContext(WhatsAppContext);
  if (context === undefined) {
    throw new Error("useWhatsAppContext deve ser usado dentro de um WhatsAppProvider");
  }
  return context;
}