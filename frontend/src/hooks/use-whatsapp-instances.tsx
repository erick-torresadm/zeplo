import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Instance } from '@shared/schema';

/**
 * Hook personalizado para gerenciar instâncias de WhatsApp
 * 
 * Este hook busca e gerencia instâncias de WhatsApp, fornecendo:
 * - Lista completa de instâncias
 * - Lista filtrada de instâncias conectadas
 * - Estado de carregamento
 * - Erro de busca
 * - Instância selecionada
 */
export function useWhatsAppInstances() {
  // Estado para armazenar o ID da instância selecionada
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');

  // Buscar todas as instâncias do usuário
  const { 
    data: instances = [], 
    isLoading, 
    error,
    refetch
  } = useQuery<Instance[]>({
    queryKey: ['/api/instances'],
    refetchInterval: 10000, // Atualiza a cada 10 segundos para manter status em tempo real
  });

  // Filtrar apenas instâncias conectadas
  // Adiciona logs para debug dos status das instâncias
  useEffect(() => {
    console.log('Status das instâncias:', instances.map(i => ({ nome: i.name, status: i.status })));
  }, [instances]);
  
  // Considera instâncias com status 'connected' ou 'open' como conectadas
  // Na Evolution API v2, uma instância conectada pode ter status 'open'
  const connectedInstances = instances.filter(
    (instance) => {
      // Corrigindo problema de tipagem - tratando vários formatos de status como "conectado"
      // Isso inclui: 'connected', 'open', 'true'
      const status = instance.status as string;
      return status === 'connected' || status === 'open' || status === 'true';
    }
  );

  // Flag para verificar se há instâncias conectadas
  const hasConnectedInstances = connectedInstances.length > 0;

  // Encontrar a instância atualmente selecionada
  const selectedInstance = instances.find(
    (instance) => instance.id === selectedInstanceId
  );

  // Definir a primeira instância conectada como selecionada quando a lista muda
  useEffect(() => {
    if (
      (!selectedInstanceId || 
       !connectedInstances.some(i => i.id === selectedInstanceId)) && 
      hasConnectedInstances
    ) {
      setSelectedInstanceId(connectedInstances[0].id);
    }
  }, [connectedInstances, selectedInstanceId, hasConnectedInstances]);

  return {
    instances,
    connectedInstances,
    isLoading,
    error,
    hasConnectedInstances,
    selectedInstanceId,
    setSelectedInstanceId,
    selectedInstance,
    refetch
  };
}