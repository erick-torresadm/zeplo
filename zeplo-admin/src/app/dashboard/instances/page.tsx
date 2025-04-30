"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Smartphone, QrCode, RefreshCw } from "lucide-react";

interface Instance {
  id: number;
  name: string;
  display_name?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/instances`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch instances');
      
      const data = await response.json();
      setInstances(data);
    } catch (error) {
      console.error('Error fetching instances:', error);
      toast.error('Failed to load WhatsApp instances');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstance = async () => {
    try {
      const name = prompt('Enter a name for your WhatsApp instance:');
      if (!name) return;
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/instances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ name }),
      });
      
      if (!response.ok) throw new Error('Failed to create instance');
      
      const data = await response.json();
      toast.success('WhatsApp instance created successfully');
      
      setInstances([...instances, data]);
    } catch (error) {
      console.error('Error creating instance:', error);
      toast.error('Failed to create WhatsApp instance');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">WhatsApp Instances</h1>
        <Button onClick={handleCreateInstance}>
          <Plus className="mr-2 h-4 w-4" /> Create Instance
        </Button>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </div>
      ) : instances.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 p-6">
            <Smartphone className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg text-center mb-4">You don't have any WhatsApp instances yet.</p>
            <Button onClick={handleCreateInstance}>
              <Plus className="mr-2 h-4 w-4" /> Create Your First Instance
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instances.map((instance) => (
            <Card key={instance.id}>
              <CardHeader>
                <CardTitle>{instance.display_name || instance.name}</CardTitle>
                <CardDescription>
                  Status: <span className={instance.status === 'connected' ? 'text-green-500' : 'text-orange-500'}>
                    {instance.status}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-2 justify-center">
                  <Button variant="outline" 
                    onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/instances/${instance.id}/qrcode`, '_blank')}>
                    <QrCode className="mr-2 h-4 w-4" /> QR Code
                  </Button>
                  <Button variant="outline">
                    <Smartphone className="mr-2 h-4 w-4" /> Connect
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 