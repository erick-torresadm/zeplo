import { Activity } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Smartphone, 
  MessageSquare, 
  AlertTriangle,
  Clock 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityCardProps {
  activities: Activity[];
}

export function ActivityCard({ activities }: ActivityCardProps) {
  const getIcon = (type: string) => {
    if (type.includes("instance")) {
      return (
        <div className="flex-shrink-0 w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center">
          <Smartphone className="h-5 w-5" />
        </div>
      );
    } else if (type.includes("flow")) {
      return (
        <div className="flex-shrink-0 w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
          <MessageSquare className="h-5 w-5" />
        </div>
      );
    } else if (type.includes("disconnected")) {
      return (
        <div className="flex-shrink-0 w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-5 w-5" />
        </div>
      );
    } else {
      return (
        <div className="flex-shrink-0 w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center">
          <Clock className="h-5 w-5" />
        </div>
      );
    }
  };

  const formatTime = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-slate-200">
          {activities.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              No recent activities to display
            </div>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getIcon(activity.type)}
                    <div>
                      <div className="font-medium text-slate-700">
                        {activity.description}
                      </div>
                      <div className="text-sm text-slate-500">
                        {activity.entityType && activity.entityId 
                          ? `${activity.entityType.charAt(0).toUpperCase() + activity.entityType.slice(1)} ID: ${activity.entityId.slice(0, 8)}...` 
                          : "System activity"}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    {formatTime(activity.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
