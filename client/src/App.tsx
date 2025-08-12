import { Switch, Route } from "wouter";
import { useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authService } from "@/lib/auth";
import RouteGuard from "@/components/auth/route-guard";

// Pages
import WelcomePage from "@/pages/welcome";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import OrganizationDashboard from "@/pages/organization-dashboard";
import SuperAdminDashboard from "@/pages/super-admin-dashboard";
import AdminLogsPage from "@/pages/admin-logs";
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
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    checkAuthentication().catch(error => {
      console.error('Authentication initialization failed:', error);
      setIsAuthenticated(false);
      setUserRole(null);
      setIsLoading(false);
      setIsInitializing(false);
    });
    
    // Set up a periodic check for authentication (4-hour intervals)
    const interval = setInterval(() => {
      // Only check local state, don't make API calls
      const currentAuthState = authService.isAuthenticated();
      const currentUser = authService.getUser(); // This gets cached user, no API call
      
      // Only update state if there's actually a change
      if (currentAuthState !== isAuthenticated) {
        setIsAuthenticated(currentAuthState);
        
        // If user logged out, clear role
        if (!currentAuthState) {
          setUserRole(null);
        }
      }
      
      // Only update role if user is authenticated and role changed
      if (currentAuthState && currentUser?.role !== userRole) {
        setUserRole(currentUser?.role || null);
      }
      
      // If token expired or became invalid, try to refresh once
      if (currentAuthState && !currentUser) {
        console.log('🔄 AUTH: Token present but no user data, refreshing...');
        checkAuthentication().catch(() => {
          // If refresh fails, user will be logged out
          setIsAuthenticated(false);
          setUserRole(null);
        });
      }
    }, 4 * 60 * 60 * 1000); // ✅ Check every 4 hours (14400000ms)

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
        } catch (error: any) {
          console.error('Failed to get current user:', error);
          // Only logout on 401/403 errors (session expired), not on network errors
          if (error.message?.includes('Session expired') || error.message?.includes('401') || error.message?.includes('403')) {
            console.log('🚪 AUTH: Session expired, logging out...');
            setIsAuthenticated(false);
            setUserRole(null);
          } else {
            console.log('⚠️ AUTH: Network error, keeping user logged in with cached data');
            // Keep user logged in with cached data during network issues
            const cachedUser = authService.getUser();
            if (cachedUser) {
              setIsAuthenticated(true);
              setUserRole(cachedUser.role);
            } else {
              setIsAuthenticated(false);
              setUserRole(null);
            }
          }
        }
      } else {
        setIsAuthenticated(false);
        setUserRole(null);
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      setIsAuthenticated(false);
      setUserRole(null);
    } finally {
      setIsLoading(false);
      setIsInitializing(false);
    }
  };

  // Show loading screen during initial app load or authentication check
  if (isLoading || isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
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
        <RouteGuard>
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
              <Route path="/admin/logs" component={AdminLogsPage} />
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
        </RouteGuard>
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
