import React from 'react';
import { Link } from 'wouter';
import { MessageSquareIcon, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WhatsAppHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  backUrl?: string;
}

/**
 * Componente de cabeçalho padrão para páginas relacionadas ao WhatsApp
 */
export default function WhatsAppHeader({
  title,
  subtitle,
  showBackButton = false,
  backUrl = '/instances'
}: WhatsAppHeaderProps) {
  return (
    <div className="flex flex-col space-y-1.5 mb-6">
      <div className="flex items-center">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 -ml-2"
            asChild
          >
            <Link to={backUrl}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        )}
        <h1 className="text-2xl font-bold tracking-tight flex items-center">
          <MessageSquareIcon className="h-6 w-6 mr-2 text-primary" />
          {title}
        </h1>
      </div>
      {subtitle && (
        <p className="text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  );
}