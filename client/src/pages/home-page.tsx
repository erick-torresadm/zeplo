import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ActivityCard } from "@/components/dashboard/activity-card";
import { Instance, MessageFlow, Activity } from "@shared/schema";
import { Smartphone, MessageSquare, Send, Loader2 } from "lucide-react";

export default function HomePage() {
  const { user } = useAuth();

  const { data: instances, isLoading: isLoadingInstances } = useQuery<Instance[]>({
    queryKey: ["/api/instances"],
  });

  const { data: flows, isLoading: isLoadingFlows } = useQuery<MessageFlow[]>({
    queryKey: ["/api/message-flows"],
  });

  const { data: activities, isLoading: isLoadingActivities } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });

  // Calculate stats
  const activeInstances = instances?.filter(i => i && i.status === "connected").length || 0;
  const disconnectedInstances = instances?.filter(i => i && i.status === "disconnected").length || 0;
  const totalInstances = instances?.filter(i => i !== null).length || 0;

  const activeFlows = flows?.filter(f => f && f.status === "active").length || 0;
  const inactiveFlows = flows?.filter(f => f && f.status === "inactive").length || 0;
  const totalFlows = flows?.filter(f => f !== null).length || 0;

  if (isLoadingInstances || isLoadingFlows || isLoadingActivities) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen">
      <div className="p-4 sm:p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Stats: Instances */}
          <StatsCard
            title="Instances"
            value={totalInstances}
            label={`${totalInstances} Total`}
            secondaryValue={activeInstances}
            secondaryLabel="Active"
            icon={<Smartphone className="h-5 w-5 mb-1" />}
            color="primary"
          />

          {/* Stats: Flows */}
          <StatsCard
            title="Message Flows"
            value={totalFlows}
            label={`${totalFlows} Total`}
            secondaryValue={activeFlows}
            secondaryLabel="Active"
            icon={<MessageSquare className="h-5 w-5 mb-1" />}
            color="whatsapp"
          />

          {/* Stats: Messages */}
          <StatsCard
            title="Messages"
            value="0"
            label="Last 7 Days"
            secondaryValue="0"
            secondaryLabel="Sent"
            icon={<Send className="h-5 w-5 mb-1" />}
            color="amber"
          />
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <ActivityCard activities={activities || []} />
        </div>
      </div>
    </div>
  );
}
