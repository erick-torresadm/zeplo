import { useState, useEffect } from 'react';
import { Flow } from '@/lib/types';
import { flowApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MessageSquare, Plus, Calendar, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function FlowList() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/flows`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch flows');
      
      const data = await response.json();
      setFlows(data);
    } catch (error) {
      toast.error('Failed to load flows');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await flowApi.deleteFlow(id);
      setFlows(flows.filter(flow => flow.id !== id));
      toast.success('Flow deleted successfully');
    } catch (error) {
      toast.error('Failed to delete flow');
    }
  };

  const handleCreateFlow = () => {
    router.push('/dashboard/flows/create');
  };

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Message Flows</h1>
        <Button onClick={handleCreateFlow}>
          <Plus className="mr-2 h-4 w-4" /> New Flow
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20 bg-muted-foreground/10 rounded-t-lg" />
              <CardContent className="p-6">
                <div className="h-6 bg-muted-foreground/10 rounded mb-4 w-2/3"></div>
                <div className="h-4 bg-muted-foreground/10 rounded w-full mb-2"></div>
                <div className="h-4 bg-muted-foreground/10 rounded w-4/5"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : flows.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No flows yet</h2>
          <p className="mt-2 text-muted-foreground">Create your first message flow to get started</p>
          <Button onClick={handleCreateFlow} className="mt-4">
            <Plus className="mr-2 h-4 w-4" /> Create Flow
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map((flow) => (
            <Card key={flow.id} className="overflow-hidden">
              <CardHeader className="bg-muted pb-4">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{flow.name}</CardTitle>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    flow.isPublished ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {flow.isPublished ? 'Published' : 'Draft'}
                  </div>
                </div>
                <CardDescription>
                  {flow.description || 'No description'} 
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex items-center text-sm text-muted-foreground mb-2">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {flow.nodes.length} nodes
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 h-4 w-4" />
                  <Clock className="ml-4 mr-2 h-4 w-4" />
                  Updated {formatDistanceToNow(new Date(flow.updatedAt), { addSuffix: true })}
                </div>
              </CardContent>
              <CardFooter className="pt-2 flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => router.push(`/dashboard/flows/${flow.id}`)}
                >
                  Edit
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => handleDelete(flow.id)}
                >
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 