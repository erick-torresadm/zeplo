"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, Image, Upload, Trash2 } from "lucide-react";

interface MediaItem {
  id: number;
  name: string;
  type: string;
  url: string;
  created_at: string;
}

export default function MediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/media`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch media');
      
      const data = await response.json();
      setMedia(data);
    } catch (error) {
      console.error('Error fetching media:', error);
      toast.error('Failed to load media');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = () => {
    // This would normally open a file upload dialog
    toast.info('Media upload functionality will be implemented soon');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Media Library</h1>
        <Button onClick={handleUpload}>
          <Upload className="mr-2 h-4 w-4" /> Upload Media
        </Button>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </div>
      ) : media.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 p-6">
            <Image className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg text-center mb-4">Your media library is empty.</p>
            <Button onClick={handleUpload}>
              <Upload className="mr-2 h-4 w-4" /> Upload Your First Media
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="aspect-square relative bg-gray-100 flex items-center justify-center">
                {item.type.startsWith('image/') ? (
                  <img 
                    src={item.url} 
                    alt={item.name} 
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full w-full p-4">
                    <Image className="h-12 w-12 text-gray-400 mb-2" />
                    <p className="text-sm text-center text-gray-600 truncate w-full">{item.type}</p>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <Button size="icon" variant="destructive" className="h-8 w-8">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-3">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 