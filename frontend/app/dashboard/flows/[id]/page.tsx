"use client";

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Flow } from '@/lib/types';
import { flowApi } from '@/lib/api';
import FlowEditor from '@/components/flow/FlowEditor';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function FlowPage() {
  const params = useParams();
  const router = useRouter();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);
  const { id } = params;

  useEffect(() => {
    if (id && id !== 'create') {
      fetchFlow();
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchFlow = async () => {
    try {
      const response = await flowApi.getFlow(id as string);
      setFlow(response.data);
    } catch (error) {
      toast.error('Failed to load flow');
      router.push('/dashboard/flows');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (savedFlow: Flow) => {
    setFlow(savedFlow);
    toast.success('Flow saved successfully');
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex items-center">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/dashboard/flows')}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Flows
        </Button>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <FlowEditor 
          flowId={id !== 'create' ? id as string : undefined} 
          onSave={handleSave}
        />
      </div>
    </div>
  );
} 