import React, { useState } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  useSortable, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { 
  Trash2, 
  GripVertical, 
  Type, 
  Image as ImageIcon, 
  FileAudio,
  Video,
  FileText,
  Menu
} from "lucide-react";
import { useFieldArray, Control, useWatch } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type MessageFieldProps = {
  control: Control<any>;
  name: string;
  onRemove: () => void;
  canRemove: boolean;
  index: number;
  id: string;
  showDelay: boolean;
};

// Componente para os campos de mídia
const MediaFields = ({ control, name, type }: { control: Control<any>; name: string; type: string }) => {
  switch (type) {
    case 'image':
      return (
        <>
          <FormField
            control={control}
            name={`${name}.mediaUrl`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">URL da Imagem</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="https://exemplo.com/imagem.jpg ou base64" 
                    {...field} 
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  Pode ser uma URL pública ou uma string base64 com prefixo <code>data:image/...</code>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${name}.caption`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Legenda (opcional)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Legenda da imagem" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${name}.fileName`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Nome do arquivo (opcional)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="imagem.jpg" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      );
    
    case 'audio':
      return (
        <>
          <FormField
            control={control}
            name={`${name}.mediaUrl`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">URL do Áudio</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="https://exemplo.com/audio.mp3 ou base64" 
                    {...field} 
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  Pode ser uma URL pública ou uma string base64 com prefixo <code>data:audio/...</code>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${name}.fileName`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Nome do arquivo (opcional)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="audio.mp3" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${name}.ptt`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={e => field.onChange(e.target.checked)}
                    className="h-4 w-4 mt-1"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Enviar como nota de voz</FormLabel>
                  <FormDescription className="text-xs">
                    Quando ativado, o áudio será enviado como uma gravação de voz (Push-to-Talk).
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </>
      );
    
    case 'video':
      return (
        <>
          <FormField
            control={control}
            name={`${name}.mediaUrl`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">URL do Vídeo</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="https://exemplo.com/video.mp4 ou base64" 
                    {...field} 
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  Pode ser uma URL pública ou uma string base64 com prefixo <code>data:video/...</code>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${name}.caption`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Legenda (opcional)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Legenda do vídeo" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${name}.fileName`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Nome do arquivo (opcional)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="video.mp4" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      );
    
    case 'document':
      return (
        <>
          <FormField
            control={control}
            name={`${name}.mediaUrl`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">URL do Documento</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="https://exemplo.com/documento.pdf ou base64" 
                    {...field} 
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  Pode ser uma URL pública ou uma string base64 com prefixo <code>data:application/...</code>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${name}.fileName`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Nome do arquivo</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="documento.pdf" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      );
      
    case 'text':
    default:
      return (
        <FormField
          control={control}
          name={`${name}.text`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">Texto da Mensagem</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Digite sua mensagem..." 
                  rows={3} 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
  }
};

// Ícone para cada tipo de mensagem
const MessageTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'image':
      return <ImageIcon className="h-4 w-4" />;
    case 'audio':
      return <FileAudio className="h-4 w-4" />;
    case 'video':
      return <Video className="h-4 w-4" />;
    case 'document':
      return <FileText className="h-4 w-4" />;
    case 'text':
    default:
      return <Type className="h-4 w-4" />;
  }
};

// Componente para um item de mensagem arrastável
const SortableMessageItem = ({ control, name, onRemove, canRemove, index, id, showDelay }: MessageFieldProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Tipo atual da mensagem
  const messageType = useWatch({
    control,
    name: `${name}.type`,
    defaultValue: 'text'
  });

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className="bg-slate-50 p-4 rounded-lg border border-slate-200"
    >
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <div 
            {...attributes} 
            {...listeners} 
            className="cursor-grab p-1 hover:bg-slate-200 rounded"
          >
            <GripVertical className="h-5 w-5 text-slate-500" />
          </div>
          <div className="flex items-center gap-1.5">
            <MessageTypeIcon type={messageType} />
            <h5 className="font-medium text-slate-700">
              Mensagem {index + 1}
              <span className="ml-1 text-xs text-slate-500 font-normal">
                ({messageType === 'text' ? 'texto' : 
                  messageType === 'image' ? 'imagem' : 
                  messageType === 'audio' ? 'áudio' : 
                  messageType === 'video' ? 'vídeo' : 
                  'documento'})
              </span>
            </h5>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FormField
            control={control}
            name={`${name}.type`}
            render={({ field }) => (
              <FormItem>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value || 'text'}
                >
                  <FormControl>
                    <SelectTrigger className="w-36 h-8">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={!canRemove}
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="mb-3 space-y-3">
        <MediaFields control={control} name={name} type={messageType} />
      </div>
      
      {showDelay && (
        <FormField
          control={control}
          name={`${name}.delay`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">Atraso após esta mensagem (segundos)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min={0} 
                  {...field} 
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
};

type SortableMessageListProps = {
  control: Control<any>;
  name: string;
};

// Lista arrastável de mensagens
export const SortableMessageList = ({ control, name }: SortableMessageListProps) => {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Mínimo de 5px de movimento para iniciar o arrastar
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((item) => item.id === active.id);
      const newIndex = fields.findIndex((item) => item.id === over.id);
      
      move(oldIndex, newIndex);
    }
  }

  const [activeTab, setActiveTab] = useState<string>("text");

  // Função para adicionar novo tipo de mensagem dependendo da tab ativa
  const addNewMessage = () => {
    switch (activeTab) {
      case "image":
        append({ 
          type: "image", 
          mediaUrl: "", 
          caption: "", 
          fileName: "", 
          delay: 3 
        });
        break;
      case "audio":
        append({ 
          type: "audio", 
          mediaUrl: "", 
          fileName: "", 
          ptt: false, 
          delay: 3 
        });
        break;
      case "video":
        append({ 
          type: "video", 
          mediaUrl: "", 
          caption: "", 
          fileName: "", 
          delay: 3 
        });
        break;
      case "document":
        append({ 
          type: "document", 
          mediaUrl: "", 
          fileName: "documento.pdf", 
          delay: 3 
        });
        break;
      case "text":
      default:
        append({ 
          type: "text", 
          text: "", 
          delay: 3 
        });
        break;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <FormLabel className="text-base">Sequência de Mensagens</FormLabel>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <div className="flex items-center justify-end">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="text" className="flex items-center gap-1 px-2 py-1">
                <Type className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Texto</span>
              </TabsTrigger>
              <TabsTrigger value="image" className="flex items-center gap-1 px-2 py-1">
                <ImageIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Imagem</span>
              </TabsTrigger>
              <TabsTrigger value="audio" className="flex items-center gap-1 px-2 py-1">
                <FileAudio className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Áudio</span>
              </TabsTrigger>
              <TabsTrigger value="video" className="flex items-center gap-1 px-2 py-1">
                <Video className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vídeo</span>
              </TabsTrigger>
              <TabsTrigger value="document" className="flex items-center gap-1 px-2 py-1">
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Documento</span>
              </TabsTrigger>
            </TabsList>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addNewMessage}
              className="ml-2 text-primary-600 hover:text-primary-800 flex items-center text-xs sm:text-sm"
            >
              + Adicionar
            </Button>
          </div>
        </Tabs>
      </div>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          <SortableContext 
            items={fields.map(field => field.id)} 
            strategy={verticalListSortingStrategy}
          >
            {fields.map((field, index) => (
              <SortableMessageItem
                key={field.id}
                id={field.id}
                control={control}
                name={`${name}.${index}`}
                index={index}
                onRemove={() => fields.length > 1 && remove(index)}
                canRemove={fields.length > 1}
                showDelay={index < fields.length - 1}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </div>
  );
};