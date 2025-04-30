"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useEffect, useState } from "react";
import { flowApi, whatsappApi } from "@/services/api";
import { MessageSquare, BarChart, Phone, FileImage, Users } from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalFlows: 0,
    activeInstances: 0,
    totalMessages: 0,
    totalMedia: 0,
    totalContacts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        // In a real app, you'd fetch all these in parallel with Promise.all
        // For now we'll just simulate with the flow API
        const flowsResponse = await flowApi.getFlows();
        
        setStats({
          totalFlows: flowsResponse.data.length,
          activeInstances: 2, // Simulated data
          totalMessages: 1547, // Simulated data
          totalMedia: 32, // Simulated data
          totalContacts: 245 // Simulated data
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Flows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="mr-4 rounded-full bg-blue-100 dark:bg-blue-900 p-2">
                <BarChart className="h-4 w-4 text-blue-500 dark:text-blue-300" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  ) : (
                    stats.totalFlows
                  )}
                </div>
                <div className="text-xs text-gray-500">Total flows</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">WhatsApp Instances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="mr-4 rounded-full bg-green-100 dark:bg-green-900 p-2">
                <Phone className="h-4 w-4 text-green-500 dark:text-green-300" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  ) : (
                    stats.activeInstances
                  )}
                </div>
                <div className="text-xs text-gray-500">Active instances</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="mr-4 rounded-full bg-indigo-100 dark:bg-indigo-900 p-2">
                <MessageSquare className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  ) : (
                    stats.totalMessages
                  )}
                </div>
                <div className="text-xs text-gray-500">Total messages</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Media</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="mr-4 rounded-full bg-purple-100 dark:bg-purple-900 p-2">
                <FileImage className="h-4 w-4 text-purple-500 dark:text-purple-300" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  ) : (
                    stats.totalMedia
                  )}
                </div>
                <div className="text-xs text-gray-500">Media files</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="mr-4 rounded-full bg-orange-100 dark:bg-orange-900 p-2">
                <Users className="h-4 w-4 text-orange-500 dark:text-orange-300" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  ) : (
                    stats.totalContacts
                  )}
                </div>
                <div className="text-xs text-gray-500">Total contacts</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Link href="/dashboard/flows">
                <Card className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900">
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <BarChart className="h-8 w-8 mb-2 text-blue-500" />
                    <span>Message Flows</span>
                  </CardContent>
                </Card>
              </Link>
              
              <Link href="/dashboard/instances">
                <Card className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900">
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <Phone className="h-8 w-8 mb-2 text-green-500" />
                    <span>WhatsApp Instances</span>
                  </CardContent>
                </Card>
              </Link>
              
              <Link href="/dashboard/media">
                <Card className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900">
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <FileImage className="h-8 w-8 mb-2 text-purple-500" />
                    <span>Media Library</span>
                  </CardContent>
                </Card>
              </Link>
              
              <Link href="/dashboard/contacts">
                <Card className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900">
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <Users className="h-8 w-8 mb-2 text-orange-500" />
                    <span>Contacts</span>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse mr-4"></div>
                    <div className="flex-1">
                      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2 w-3/4"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-2 mr-4">
                    <BarChart className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="font-medium">New flow created</div>
                    <div className="text-sm text-gray-500">2 hours ago</div>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="rounded-full bg-green-100 dark:bg-green-900 p-2 mr-4">
                    <Phone className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <div className="font-medium">WhatsApp instance connected</div>
                    <div className="text-sm text-gray-500">3 hours ago</div>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="rounded-full bg-indigo-100 dark:bg-indigo-900 p-2 mr-4">
                    <MessageSquare className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div>
                    <div className="font-medium">123 messages sent</div>
                    <div className="text-sm text-gray-500">Yesterday</div>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="rounded-full bg-purple-100 dark:bg-purple-900 p-2 mr-4">
                    <FileImage className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <div className="font-medium">5 media files uploaded</div>
                    <div className="text-sm text-gray-500">Yesterday</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 