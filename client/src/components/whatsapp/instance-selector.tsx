import { useWhatsAppContext } from "@/context/whatsapp-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface InstanceSelectorProps {
  onInstanceChange?: (instanceId: string) => void;
  className?: string;
  showAlert?: boolean;
}

/**
 * Componente para seleção de instâncias do WhatsApp
 * 
 * Este componente oferece um seletor de instâncias conectadas e 
 * opcionalmente exibe um alerta quando não há instâncias conectadas.
 */
export function InstanceSelector({
  onInstanceChange,
  className = "",
  showAlert = true
}: InstanceSelectorProps) {
  const {
    connectedInstances,
    isLoading,
    hasConnectedInstances,
    selectedInstanceId,
    setSelectedInstanceId
  } = useWhatsAppContext();

  // Manipular a mudança de instância
  const handleInstanceChange = (value: string) => {
    setSelectedInstanceId(value);
    if (onInstanceChange) {
      onInstanceChange(value);
    }
  };

  return (
    <div className={className}>
      {showAlert && !hasConnectedInstances && !isLoading && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Nenhuma instância conectada</AlertTitle>
          <AlertDescription>
            Conecte uma instância do WhatsApp para utilizar esta funcionalidade.
          </AlertDescription>
        </Alert>
      )}

      <Select
        disabled={isLoading || !hasConnectedInstances}
        value={selectedInstanceId}
        onValueChange={handleInstanceChange}
      >
        <SelectTrigger className="w-full">
          {isLoading ? (
            <div className="flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>Carregando instâncias...</span>
            </div>
          ) : (
            <SelectValue placeholder="Selecione uma instância" />
          )}
        </SelectTrigger>
        <SelectContent>
          {connectedInstances.map((instance: { id: string, name: string }) => (
            <SelectItem key={instance.id} value={instance.id}>
              {instance.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}