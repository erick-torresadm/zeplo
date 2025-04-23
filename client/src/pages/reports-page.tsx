import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ChartBarStacked, 
  TrendingUp, 
  TrendingDown, 
  MessageSquare
} from "lucide-react";
import { Instance, MessageFlow } from "@shared/schema";

export default function ReportsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  const { data: instances } = useQuery<Instance[]>({
    queryKey: ["/api/instances"],
  });

  const { data: flows } = useQuery<MessageFlow[]>({
    queryKey: ["/api/message-flows"],
  });

  // Mock top flows data
  const topFlows = [
    {
      name: "Promotions Flow",
      instance: instances?.[0]?.name || "Unknown",
      activations: 0,
      responseRate: "0%",
      trend: "up",
      trendValue: "0%"
    },
    {
      name: "Welcome Flow",
      instance: instances?.[0]?.name || "Unknown",
      activations: 0,
      responseRate: "0%",
      trend: "up",
      trendValue: "0%"
    },
    {
      name: "Support Flow",
      instance: instances?.[0]?.name || "Unknown",
      activations: 0,
      responseRate: "0%",
      trend: "down",
      trendValue: "0%"
    }
  ];

  return (
    <div>
      <MobileHeader
        onMenuClick={() => setSidebarOpen(true)}
        title="Reports"
      />

      <div className="flex">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 min-h-screen lg:ml-64">
          <div className="p-4 sm:p-6 md:p-8">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Reports</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Total Messages */}
              <StatsCard
                title="Total Messages"
                value="0"
                label="Last 30 days"
                icon={<MessageSquare className="h-5 w-5 mb-1" />}
                color="primary"
              />
              
              {/* Active Flows */}
              <StatsCard
                title="Active Flows"
                value={flows?.filter(f => f.status === "active").length || 0}
                label="Current"
                secondaryValue={flows?.length || 0}
                secondaryLabel="Total Flows"
                icon={<MessageSquare className="h-5 w-5 mb-1" />}
                color="whatsapp"
              />
              
              {/* Response Rate */}
              <StatsCard
                title="Response Rate"
                value="0%"
                label="Last 30 days"
                icon={<MessageSquare className="h-5 w-5 mb-1" />}
                color="amber"
              />
            </div>
            
            {/* Chart Area */}
            <Card className="mb-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold text-slate-700">Messages per Day</CardTitle>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="text-xs bg-primary-600 text-white hover:bg-primary-700 border-primary-600">
                    Last 7 days
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200">
                    Last 30 days
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200">
                    Last 90 days
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full bg-slate-50 rounded-lg flex items-center justify-center">
                  <div className="text-slate-400 flex flex-col items-center">
                    <ChartBarStacked className="h-10 w-10 mb-2" />
                    <span>Chart of sent/received messages</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Top Flows */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-700">Top Performing Flows</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Flow Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Instance
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Activations
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Response Rate
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Trend
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {flows && flows.length > 0 ? (
                        topFlows.map((flow, index) => (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                              {flow.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                              {flow.instance}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                              {flow.activations}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                              {flow.responseRate}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`flex items-center ${flow.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                                {flow.trend === 'up' ? (
                                  <TrendingUp className="h-4 w-4 mr-1" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 mr-1" />
                                )}
                                <span>{flow.trendValue}</span>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                            No data available. Create message flows to see reports.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
