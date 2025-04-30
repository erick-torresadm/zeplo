"use client";

import { useState, useEffect } from 'react';
import { Flow } from '@/types/flow';
import { FlowProvider } from '@/hooks/useFlowContext';
import { flowApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, ExternalLink } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';

export default function FlowList() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowDescription, setNewFlowDescription] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchFlows();
  }, []);

  async function fetchFlows() {
    setLoading(true);
    try {
      const response = await flowApi.getFlows();
      setFlows(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load flows');
      console.error('Error fetching flows:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFlow() {
    if (!newFlowName.trim()) return;
    
    try {
      const response = await flowApi.createFlow({
        name: newFlowName,
        description: newFlowDescription,
        nodes: [
          {
            id: 'start',
            type: 'start',
            name: 'Start',
            position: { x: 100, y: 100 },
            data: {}
          }
        ],
        connections: []
      });
      
      setFlows([...flows, response.data]);
      setIsCreateDialogOpen(false);
      setNewFlowName('');
      setNewFlowDescription('');
      
      // Navigate to the new flow editor
      router.push(`/dashboard/flows/${response.data.id}`);
    } catch (err: any) {
      console.error('Error creating flow:', err);
    }
  }

  async function handleDeleteFlow(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this flow?')) return;
    
    try {
      await flowApi.deleteFlow(id);
      setFlows(flows.filter(flow => flow.id !== id));
    } catch (err: any) {
      console.error('Error deleting flow:', err);
    }
  }

  return (
    <FlowProvider>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Message Flows</h1>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Flow
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Flow</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Flow Name</Label>
                  <Input
                    id="name"
                    value={newFlowName}
                    onChange={(e) => setNewFlowName(e.target.value)}
                    placeholder="My New Flow"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    value={newFlowDescription}
                    onChange={(e) => setNewFlowDescription(e.target.value)}
                    placeholder="What does this flow do?"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateFlow}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        <Tabs defaultValue="all">
          <TabsList className="mb-6">
            <TabsTrigger value="all">All Flows</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="draft">Drafts</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                    </CardContent>
                    <CardFooter>
                      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                    </CardFooter>
                  </Card>
                ))
              ) : error ? (
                <div className="col-span-3 text-center py-12">
                  <p className="text-red-500">{error}</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={fetchFlows}
                  >
                    Try Again
                  </Button>
                </div>
              ) : flows.length === 0 ? (
                <div className="col-span-3 text-center py-12">
                  <p className="text-gray-500 mb-4">No flows found. Create your first flow to get started.</p>
                  <Button 
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create Flow
                  </Button>
                </div>
              ) : (
                flows.map(flow => (
                  <Link 
                    href={`/dashboard/flows/${flow.id}`}
                    key={flow.id}
                    className="block transition-transform hover:scale-[1.02]"
                  >
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              {flow.name}
                              {flow.isPublished && (
                                <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-0.5 rounded-full">
                                  Published
                                </span>
                              )}
                            </CardTitle>
                            {flow.description && (
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                {flow.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex justify-between text-sm text-gray-500">
                          <div>Nodes: {flow.nodes?.length || 0}</div>
                          <div>
                            Updated: {new Date(flow.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between pt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex items-center gap-1"
                          onClick={(e) => {
                            e.preventDefault();
                            router.push(`/dashboard/flows/${flow.id}`);
                          }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1 text-red-500"
                            onClick={(e) => handleDeleteFlow(flow.id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                            onClick={(e) => {
                              e.preventDefault();
                              // Preview flow
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="published">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {!loading && flows.filter(flow => flow.isPublished).length === 0 && (
                <div className="col-span-3 text-center py-12">
                  <p className="text-gray-500">No published flows found.</p>
                </div>
              )}
              
              {!loading && flows
                .filter(flow => flow.isPublished)
                .map(flow => (
                  <Link 
                    href={`/dashboard/flows/${flow.id}`}
                    key={flow.id}
                    className="block transition-transform hover:scale-[1.02]"
                  >
                    {/* Same card as above, but only for published flows */}
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              {flow.name}
                              <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-0.5 rounded-full">
                                Published
                              </span>
                            </CardTitle>
                            {flow.description && (
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                {flow.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex justify-between text-sm text-gray-500">
                          <div>Nodes: {flow.nodes?.length || 0}</div>
                          <div>
                            Updated: {new Date(flow.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between pt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex items-center gap-1"
                          onClick={(e) => {
                            e.preventDefault();
                            router.push(`/dashboard/flows/${flow.id}`);
                          }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1 text-red-500"
                            onClick={(e) => handleDeleteFlow(flow.id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                            onClick={(e) => {
                              e.preventDefault();
                              // Preview flow
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  </Link>
                ))}
            </div>
          </TabsContent>
          
          <TabsContent value="draft">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {!loading && flows.filter(flow => !flow.isPublished).length === 0 && (
                <div className="col-span-3 text-center py-12">
                  <p className="text-gray-500">No draft flows found.</p>
                </div>
              )}
              
              {!loading && flows
                .filter(flow => !flow.isPublished)
                .map(flow => (
                  <Link 
                    href={`/dashboard/flows/${flow.id}`}
                    key={flow.id}
                    className="block transition-transform hover:scale-[1.02]"
                  >
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{flow.name}</CardTitle>
                            {flow.description && (
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                {flow.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex justify-between text-sm text-gray-500">
                          <div>Nodes: {flow.nodes?.length || 0}</div>
                          <div>
                            Updated: {new Date(flow.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between pt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex items-center gap-1"
                          onClick={(e) => {
                            e.preventDefault();
                            router.push(`/dashboard/flows/${flow.id}`);
                          }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1 text-red-500"
                            onClick={(e) => handleDeleteFlow(flow.id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                            onClick={(e) => {
                              e.preventDefault();
                              // Preview flow
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  </Link>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </FlowProvider>
  );
} 