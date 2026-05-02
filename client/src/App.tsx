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
import Admin from "@/pages/Admin";
import ChurnSurvey from "@/pages/ChurnSurvey";
import BusinessDashboard from "@/pages/BusinessDashboard";
import { Sentry } from "@/lib/monitoring";
import { useState, useEffect } from "react";

function UpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let firstController = navigator.serviceWorker.controller;
    const handler = () => {
      if (firstController) {
        setShowBanner(true);
      }
      firstController = navigator.serviceWorker.controller;
    };
    navigator.serviceWorker.addEventListener("controllerchange", handler);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", handler);
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 bg-cyan-500 px-4 py-3 shadow-lg">
      <p className="text-blue-950 text-sm font-semibold">🧊 ColdStreak was updated!</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-950 text-cyan-300 text-xs font-bold px-3 py-1.5 rounded-lg"
        >
          Reload
        </button>
        <button
          onClick={() => setShowBanner(false)}
          className="text-blue-950 text-xs font-bold px-2 py-1.5 rounded-lg opacity-70"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

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
      <Route path="/feedback/:token" component={ChurnSurvey} />
      <Route path="/admin" component={Admin} />
      <Route path="/business" component={BusinessDashboard} />
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
          <UpdateBanner />
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;
