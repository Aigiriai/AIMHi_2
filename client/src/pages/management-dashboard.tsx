import { useLocation } from "wouter";
import ProtectedRoute from "@/components/auth/protected-route";
import Navbar from "@/components/navigation/navbar";
import ManagementNav from "@/components/navigation/management-nav";

// Import existing page components
import SuperAdminDashboard from "@/pages/super-admin-dashboard";
import OrganizationsPage from "@/pages/organizations";
import OnboardingDashboard from "@/pages/onboarding-dashboard";
import AnalyticsPage from "@/pages/analytics";
import SettingsPage from "@/pages/settings";

export default function ManagementDashboard() {
  const [location] = useLocation();

  // Determine which sub-dashboard to render based on the current path
  const renderSubDashboard = () => {
    if (location === "/management/organizations" || location.startsWith("/management/organizations/")) {
      return <OrganizationsPage />;
    }
    if (location === "/management/onboarding" || location.startsWith("/management/onboarding/")) {
      return <OnboardingDashboard />;
    }
    if (location === "/management/analytics" || location.startsWith("/management/analytics/")) {
      return <AnalyticsPage />;
    }
    if (location === "/management/settings" || location.startsWith("/management/settings/")) {
      return <SettingsPage />;
    }
    // Default to dashboard view
    return <SuperAdminDashboard />;
  };

  return (
    <ProtectedRoute requiredRoles={['super_admin']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <ManagementNav />
        <div className="flex-1">
          {renderSubDashboard()}
        </div>
      </div>
    </ProtectedRoute>
  );
}