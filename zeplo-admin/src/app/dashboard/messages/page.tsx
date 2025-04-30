"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, MessageSquare } from "lucide-react";

interface Message {
  id: number;
  from: string;
  content: string;
  direction: 'inbound' | 'outbound';
  timestamp: string;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      // Note: This endpoint might need to be adjusted based on your actual backend API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/contacts/messages`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch messages');
      
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Messages</h1>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 p-6">
            <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg text-center">No messages found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <Card key={message.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-full ${message.direction === 'inbound' ? 'bg-blue-100' : 'bg-green-100'}`}>
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-semibold">{message.direction === 'inbound' ? 'From: ' : 'To: '} {message.from}</p>
                    <p className="text-sm text-gray-500">{new Date(message.timestamp).toLocaleString()}</p>
                  </div>
                  <p className="text-gray-700">{message.content}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 