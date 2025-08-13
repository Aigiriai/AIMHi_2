import { useEffect, useState, createContext } from "react";
import ProtectedRoute from "@/components/auth/protected-route";
import Navbar from "@/components/navigation/navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LayoutDashboard, 
  Building2, 
  UserPlus, 
  Settings as SettingsIcon
} from "lucide-react";

// Import existing page components
import SuperAdminDashboard from "@/pages/super-admin-dashboard";
import OrganizationsPage from "@/pages/organizations";
import OnboardingDashboard from "@/pages/onboarding-dashboard";

import SettingsPage from "@/pages/settings";
import SystemManagement from "@/pages/system-management";

// Create context to tell embedded components they're in a tab
export const TabContext = createContext({ isInTab: false });

function ManagementDashboard() {
  const getInitialTab = () => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash) return hash;
    }
    return "dashboard";
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash) setActiveTab(hash);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const tabs = [
    { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { value: "organizations", label: "Organizations", icon: Building2 },
    { value: "onboarding", label: "Onboarding", icon: UserPlus },
    { value: "settings", label: "Settings", icon: SettingsIcon },
    { value: "system", label: "System", icon: SettingsIcon },
  ];

  return (
    <ProtectedRoute requiredRoles={['super_admin']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Management</h1>
            </div>
            <p className="text-gray-600">Multi-tenancy platform management and administration</p>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (typeof window !== 'undefined') window.location.hash = `#${v}`; }}>
            <TabsList className="grid w-full grid-cols-5 mb-8">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger 
                    key={tab.value} 
                    value={tab.value}
                    className="flex items-center space-x-2"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="mt-0">
              <div style={{ display: 'contents' }}>
                <style dangerouslySetInnerHTML={{
                  __html: `
                    .tab-content nav { display: none !important; }
                    .tab-content .min-h-screen { min-height: auto !important; }
                    .tab-content .bg-gray-50 { background: transparent !important; }
                    .tab-content .container { margin: 0 !important; padding: 0 !important; max-width: none !important; }
                    .tab-content .py-8 { padding-top: 0 !important; padding-bottom: 0 !important; }
                  `
                }} />
                <div className="tab-content">
                  <SuperAdminDashboard />
                </div>
              </div>
            </TabsContent>

            {/* Organizations Tab */}
            <TabsContent value="organizations" className="mt-0">
              <div className="tab-content">
                <OrganizationsPage />
              </div>
            </TabsContent>

            {/* Onboarding Tab */}
            <TabsContent value="onboarding" className="mt-0">
              <div className="tab-content">
                <OnboardingDashboard />
              </div>
            </TabsContent>

            

            {/* Settings Tab */}
            <TabsContent value="settings" className="mt-0">
              <div className="tab-content">
                <SettingsPage />
              </div>
            </TabsContent>

            {/* System Management Tab (Super Admin only) */}
            <TabsContent value="system" className="mt-0">
              <div className="tab-content">
                <SystemManagement />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default ManagementDashboard;