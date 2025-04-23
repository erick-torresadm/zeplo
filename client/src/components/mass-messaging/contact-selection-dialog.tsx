import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { WhatsAppContact } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import debounce from 'lodash/debounce';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, CheckIcon, Users } from "lucide-react";

interface ContactSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactsSelected: (contacts: WhatsAppContact[]) => void;
  selectedContacts: WhatsAppContact[];
  instanceId: string;
}

export default function ContactSelectionDialog({
  open,
  onOpenChange,
  onContactsSelected,
  selectedContacts,
  instanceId,
}: ContactSelectionDialogProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [localSelectedContacts, setLocalSelectedContacts] = useState<WhatsAppContact[]>(selectedContacts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Reset local selection when dialog opens
  useEffect(() => {
    if (open) {
      setLocalSelectedContacts(selectedContacts);
      setSearchTerm("");
      setPage(1);
      setHasMore(true);
    }
  }, [open, selectedContacts]);

  // Busca contatos
  const {
    data: contacts,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/contacts", instanceId, searchTerm, page],
    queryFn: async () => {
      if (!instanceId) return { contacts: [], hasMore: false };
      const res = await apiRequest("GET", `/api/contacts/${instanceId}?search=${searchTerm}&page=${page}`);
      const data = await res.json();
      setHasMore(data.hasMore || false);
      return data;
    },
    enabled: open && !!instanceId,
  });

  // Manipula seleção de contato
  const toggleContact = (contact: WhatsAppContact) => {
    setLocalSelectedContacts((current) => {
      const exists = current.some(c => c.phoneNumber === contact.phoneNumber);
      if (exists) {
        return current.filter(c => c.phoneNumber !== contact.phoneNumber);
      } else {
        return [...current, contact];
      }
    });
  };

  // Confirma seleção
  const confirmSelection = () => {
    onContactsSelected(localSelectedContacts);
  };

  // Seleciona/deseleciona todos da página atual
  const toggleSelectAll = () => {
    if (!contacts?.contacts) return;
    
    // Verificar se todos os contatos da página atual estão selecionados
    const allSelected = contacts.contacts.every((contact: WhatsAppContact) => 
      localSelectedContacts.some(c => c.phoneNumber === contact.phoneNumber)
    );
    
    if (allSelected) {
      // Remover os contatos da página atual da seleção
      setLocalSelectedContacts(localSelectedContacts.filter(selected => 
        !contacts.contacts.some((contact: WhatsAppContact) => contact.phoneNumber === selected.phoneNumber)
      ));
    } else {
      // Adicionar os contatos da página atual que ainda não estão selecionados
      const contactsToAdd = contacts.contacts.filter((contact: WhatsAppContact) => 
        !localSelectedContacts.some(c => c.phoneNumber === contact.phoneNumber)
      );
      setLocalSelectedContacts([...localSelectedContacts, ...contactsToAdd]);
    }
  };

  // Carregar mais contatos
  const loadMore = () => {
    if (hasMore && !isLoading) {
      setPage(p => p + 1);
    }
  };

  // Debounce para a pesquisa
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
      setPage(1);
    }, 500),
    []
  );

  // Manipula mudança no campo de pesquisa
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  // Verificar se todos os contatos estão selecionados
  const allContactsSelected = contacts?.contacts && contacts.contacts.length > 0 && 
    contacts.contacts.every((contact: WhatsAppContact) => 
      localSelectedContacts.some(c => c.phoneNumber === contact.phoneNumber)
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Contatos</DialogTitle>
          <DialogDescription>
            Selecione os contatos para enviar mensagens em massa.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-x-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contatos..."
              className="pl-8"
              onChange={handleSearchChange}
            />
          </div>
          {localSelectedContacts.length > 0 && (
            <Badge variant="secondary" className="py-1 px-3">
              {localSelectedContacts.length} selecionado(s)
            </Badge>
          )}
        </div>

        <ScrollArea className="flex-1 border rounded-md">
          {!instanceId ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-4">
              <Users className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
              <h3 className="text-lg font-medium">Selecione uma instância primeiro</h3>
              <p className="text-muted-foreground mt-2">
                Você precisa selecionar uma instância para visualizar os contatos
              </p>
            </div>
          ) : isLoading && page === 1 ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : contacts?.contacts && contacts.contacts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={allContactsSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.contacts.map((contact: WhatsAppContact) => {
                  const isSelected = localSelectedContacts.some(
                    c => c.phoneNumber === contact.phoneNumber
                  );
                  return (
                    <TableRow 
                      key={contact.phoneNumber} 
                      className={`cursor-pointer ${isSelected ? 'bg-primary-50' : ''}`}
                      onClick={() => toggleContact(contact)}
                    >
                      <TableCell>
                        <Checkbox 
                          checked={isSelected} 
                          onCheckedChange={() => toggleContact(contact)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {contact.name || contact.pushName || 'Sem nome'}
                        {isSelected && (
                          <span className="ml-2 text-primary-600">
                            <CheckIcon className="h-4 w-4 inline" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{contact.phoneNumber}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center p-4">
              <h3 className="text-lg font-medium">Nenhum contato encontrado</h3>
              <p className="text-muted-foreground mt-2">
                {searchTerm 
                  ? `Nenhum resultado para "${searchTerm}"`
                  : "Não há contatos disponíveis para esta instância"}
              </p>
            </div>
          )}
          
          {/* Botão de carregar mais */}
          {hasMore && (
            <div className="p-4 flex justify-center">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoading}
              >
                {isLoading && page > 1 ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  "Carregar mais"
                )}
              </Button>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="pt-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {localSelectedContacts.length > 0 && (
                <span>
                  {localSelectedContacts.length} contato(s) selecionado(s)
                </span>
              )}
            </div>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmSelection}>
                Confirmar Seleção
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}