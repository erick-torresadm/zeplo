import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import InstancesPage from "@/pages/instances-page";
import MessageFlowsPage from "@/pages/message-flows-page";
import AnalyticsPage from "@/pages/analytics-page";
import ReportsPage from "@/pages/reports-page";
import MessageHistoryPage from "@/pages/message-history-page";
import MassMessagingPage from "@/pages/mass-messaging-simplified";
import SystemLogsPage from "@/pages/system-logs-page";
import FlowQueuePage from "@/pages/flow-queue-page";
import DebugToolsPage from "@/pages/debug-tools-page";
import { AuthProvider } from "@/hooks/use-auth";
import { WhatsAppProvider } from "@/context/whatsapp-context";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/instances" component={InstancesPage} />
      <ProtectedRoute path="/message-flows" component={MessageFlowsPage} />
      <ProtectedRoute path="/flow-queue" component={FlowQueuePage} />
      <ProtectedRoute path="/analytics" component={AnalyticsPage} />
      <ProtectedRoute path="/reports" component={ReportsPage} />
      <ProtectedRoute path="/message-history" component={MessageHistoryPage} />
      <ProtectedRoute path="/mass-messaging" component={MassMessagingPage} />
      <ProtectedRoute path="/system-logs" component={SystemLogsPage} />
      <ProtectedRoute path="/debug-tools" component={DebugToolsPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WhatsAppProvider>
          <Router />
          <Toaster />
        </WhatsAppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
