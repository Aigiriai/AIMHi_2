import { Switch, Route } from "wouter";
import { useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authService } from "@/lib/auth";

// Pages
import WelcomePage from "@/pages/welcome";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import OrganizationDashboard from "@/pages/organization-dashboard";
import SuperAdminDashboard from "@/pages/super-admin-dashboard";
import ManagementDashboard from "@/pages/management";
import RecruitmentDashboard from "@/pages/recruitment";
import OrganizationsPage from "@/pages/organizations";
import AnalyticsPage from "@/pages/analytics";
import SettingsPage from "@/pages/settings";
import ProfilePage from "@/pages/profile";
import OnboardingDashboard from "@/pages/onboarding-dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  console.log('Router component initializing...');
  const [isAuthenticated, setIsAuthenticated] = useState(() => authService.isAuthenticated());
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(() => authService.getUser()?.role || null);

  useEffect(() => {
    checkAuthentication().catch(error => {
      console.error('Authentication initialization failed:', error);
      setIsAuthenticated(false);
      setUserRole(null);
      setIsLoading(false);
    });
    
    // Set up a simple interval to check authentication periodically
    const interval = setInterval(() => {
      const currentAuthState = authService.isAuthenticated();
      const currentUser = authService.getUser();
      
      if (currentAuthState !== isAuthenticated || currentUser?.role !== userRole) {
        setIsAuthenticated(currentAuthState);
        setUserRole(currentUser?.role || null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, userRole]);

  const checkAuthentication = async () => {
    setIsLoading(true);
    try {
      if (authService.isAuthenticated()) {
        try {
          const user = await authService.getCurrentUser();
          setIsAuthenticated(true);
          setUserRole(user.role);
          console.log('Authentication successful:', user.role);

        } catch (userError) {
          console.error('Failed to get user data:', userError);
          // Clear auth state on error
          authService.clearAuth();
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } else {
        console.log('No authentication token found');
        setIsAuthenticated(false);
        setUserRole(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setUserRole(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/" component={WelcomePage} />
      <Route path="/login" component={LoginPage} />
      
      {/* Protected Routes */}
      {isAuthenticated ? (
        <>
          {/* Super Admin Routes */}
          {userRole === 'super_admin' && (
            <>
              {/* Main Dashboards */}
              <Route path="/management" component={ManagementDashboard} />
              <Route path="/recruitment" component={RecruitmentDashboard} />
              <Route path="/dashboard" component={RecruitmentDashboard} />
              
              {/* Legacy Routes for backward compatibility */}
              <Route path="/admin/dashboard" component={SuperAdminDashboard} />
              <Route path="/admin/platform" component={SuperAdminDashboard} />
              <Route path="/admin/organizations" component={OrganizationsPage} />
              <Route path="/admin/onboarding" component={OnboardingDashboard} />
              <Route path="/organizations" component={OrganizationsPage} />
              <Route path="/onboarding" component={OnboardingDashboard} />
              <Route path="/analytics" component={AnalyticsPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/legacy" component={Dashboard} />
              
              {/* Default authenticated route redirects to Management Dashboard */}
              <Route path="/app" component={ManagementDashboard} />
            </>
          )}
          
          {/* Organization Routes */}
          {(userRole === 'org_admin' || userRole === 'manager' || userRole === 'team_lead' || userRole === 'recruiter') && (
            <>
              {/* Main Recruitment Dashboard */}
              <Route path="/recruitment" component={RecruitmentDashboard} />
              
              {/* Legacy Routes for backward compatibility */}
              <Route path="/dashboard" component={OrganizationDashboard} />
              <Route path="/analytics" component={AnalyticsPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/legacy" component={Dashboard} />
              
              {/* Default authenticated route redirects to Recruitment Dashboard */}
              <Route path="/app" component={RecruitmentDashboard} />
            </>
          )}
          
          {/* Fallback route for any authenticated user that doesn't match above */}
          {isAuthenticated && userRole && (
            <Route path="/fallback">
              <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900">Welcome!</h1>
                  <p className="text-gray-600 mt-2">User Role: {userRole}</p>
                  <p className="text-gray-600">Redirecting to appropriate dashboard...</p>
                  <script>{`
                    setTimeout(() => {
                      window.location.href = '${userRole === 'super_admin' ? '/management' : '/recruitment'}';
                    }, 2000);
                  `}</script>
                </div>
              </div>
            </Route>
          )}
          
          {/* Legacy Dashboard Route (for backward compatibility) */}
          <Route path="/legacy" component={Dashboard} />
        </>
      ) : (
        /* Show welcome page for unauthenticated users on protected routes */
        <Route path="/app/*" component={WelcomePage} />
      )}
      
      {/* Unauthorized Route */}
      <Route path="/unauthorized">
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Unauthorized</h1>
            <p className="text-gray-600 mt-2">You don't have permission to access this page</p>
          </div>
        </div>
      </Route>
      
      {/* 404 Route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  console.log('App component rendering...');
  
  try {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    );
  } catch (error) {
    console.error('App render error:', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-600">Application Error</h1>
          <p className="text-red-500 mt-2">Failed to load the application</p>
          <p className="text-sm text-gray-600 mt-2">Check the console for details</p>
        </div>
      </div>
    );
  }
}

export default App;
