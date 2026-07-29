import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/language-context";
import { AuthProvider } from "@/contexts/auth-context";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import CustomerDashboard from "@/pages/CustomerDashboard";
import CarrierDashboard from "@/pages/CarrierDashboard";
import PartnerDashboard from "@/pages/PartnerDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import OrderPage from "@/pages/OrderPage";
import OfferPage from "@/pages/OfferPage";
import DealsPage from "@/pages/DealsPage";
import AdminOrderDetails from "@/pages/AdminOrderDetails";
import NotFound from "@/pages/not-found";
import PublicAnnouncementsPage from "@/pages/PublicAnnouncementsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import DeleteAccountPage from "@/pages/DeleteAccountPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/announcements" component={PublicAnnouncementsPage} />
      <Route path="/deals" component={DealsPage} />
      <Route path="/order/:id" component={({params}) => <OrderPage params={params} />} />
      <Route path="/offer/:id" component={({params}) => <OfferPage params={params} />} />
      <Route path="/customer/:section?" component={({params}) => <CustomerDashboard section={params.section} />} />
      <Route path="/carrier/:section?" component={({params}) => <CarrierDashboard section={params.section} />} />
      <Route path="/partner/:section?" component={({params}) => <PartnerDashboard section={params.section} />} />
      <Route path="/admin-order/:id" component={({params}) => <AdminOrderDetails params={params} />} />
      <Route path="/admin/:section?" component={({params}) => <AdminDashboard section={params.section} />} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/delete-account" component={DeleteAccountPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </AuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
