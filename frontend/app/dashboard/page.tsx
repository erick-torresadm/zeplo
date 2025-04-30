"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { whatsappApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { WhatsAppInstance } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MessageSquare, QrCode, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    } else if (isAuthenticated) {
      fetchInstances();
    }
  }, [isAuthenticated, authLoading, router]);

  const fetchInstances = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/whatsapp/instances`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch instances');
      
      const data = await response.json();
      setInstances(data);
    } catch (error) {
      toast.error('Failed to load WhatsApp instances');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstance = async () => {
    try {
      const name = prompt('Enter a name for your WhatsApp instance:');
      if (!name) return;
      
      const response = await whatsappApi.createInstance(name);
      toast.success('WhatsApp instance created successfully');
      
      setInstances([...instances, response.data]);
    } catch (error) {
      toast.error('Failed to create WhatsApp instance');
    }
  };

  const handleConnectInstance = async (instanceId: string) => {
    try {
      await whatsappApi.connectInstance(instanceId);
      router.push(`/dashboard/whatsapp/${instanceId}`);
    } catch (error) {
      toast.error('Failed to connect to WhatsApp instance');
    }
  };

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="container py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back{user?.name ? `, ${user.name}` : ''}! Manage your WhatsApp automations.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="mr-2 h-5 w-5" /> 
              Message Flows
            </CardTitle>
            <CardDescription>
              Create and manage your automated message sequences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="text-center p-4">
                <Button onClick={() => router.push('/dashboard/flows')}>
                  View All Flows
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  variant="outline"
                  className="flex flex-col h-24 p-2"
                  onClick={() => router.push('/dashboard/flows/create')}
                >
                  <Plus className="h-6 w-6 mb-2" />
                  <span>New Flow</span>
                </Button>
                <Button 
                  variant="outline"
                  className="flex flex-col h-24 p-2"
                  onClick={() => router.push('/dashboard/broadcast')}
                >
                  <Send className="h-6 w-6 mb-2" />
                  <span>Broadcast</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <path d="M3 21l1.9-5.7a8.5 8.5 0 113.8 3.8z" />
              </svg>
              WhatsApp Connections
            </CardTitle>
            <CardDescription>
              Manage your connected WhatsApp devices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-6">Loading...</div>
            ) : instances.length === 0 ? (
              <div className="text-center p-4">
                <p className="mb-4 text-muted-foreground">No WhatsApp instances yet</p>
                <Button onClick={handleCreateInstance}>
                  <Plus className="mr-2 h-4 w-4" /> Create Instance
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {instances.map((instance) => (
                  <div key={instance.id} className="flex justify-between items-center p-3 border rounded-md">
                    <div>
                      <h3 className="font-medium">{instance.name}</h3>
                      <div className={`text-xs rounded-full px-2 py-0.5 inline-block ${
                        instance.status === 'connected' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {instance.status}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnectInstance(instance.id)}
                    >
                      {instance.status === 'connected' ? 'Manage' : <><QrCode className="mr-2 h-4 w-4" /> Connect</>}
                    </Button>
                  </div>
                ))}
                <Button onClick={handleCreateInstance} className="w-full mt-4" variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Add Instance
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Media Library</CardTitle>
            <CardDescription>Manage your media files</CardDescription>
          </CardHeader>
          <CardContent className="text-center p-4">
            <Button onClick={() => router.push('/dashboard/media')}>
              View Media
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>Manage your contacts</CardDescription>
          </CardHeader>
          <CardContent className="text-center p-4">
            <Button onClick={() => router.push('/dashboard/contacts')}>
              View Contacts
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
            <CardDescription>View message statistics</CardDescription>
          </CardHeader>
          <CardContent className="text-center p-4">
            <Button onClick={() => router.push('/dashboard/analytics')}>
              View Analytics
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 