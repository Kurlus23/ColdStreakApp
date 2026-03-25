import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import BadgeProfile from "@/pages/BadgeProfile";
import DeleteAccount from "@/pages/DeleteAccount";
import EventPage from "@/pages/EventPage";
import { Sentry } from "@/lib/monitoring";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/profile/:username" component={BadgeProfile} />
      <Route path="/delete-account" component={DeleteAccount} />
      <Route path="/event/:code" component={EventPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <Sentry.ErrorBoundary fallback={
      <div className="min-h-screen bg-blue-950 flex items-center justify-center text-white text-center px-6">
        <div>
          <p className="text-4xl mb-4">🧊</p>
          <p className="font-bold text-lg mb-2">Something went wrong</p>
          <p className="text-blue-300 text-sm mb-6">Try refreshing the page.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-cyan-500 text-blue-950 font-bold px-6 py-3 rounded-xl"
          >
            Refresh
          </button>
        </div>
      </div>
    }>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;
