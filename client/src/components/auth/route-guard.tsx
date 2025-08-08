import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { authService } from "@/lib/auth";

interface RouteGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Route Guard component to prevent 404 errors during auth state transitions
 * This component ensures users are properly redirected if they land on protected routes
 * without being authenticated, which can happen in deployment environments
 */
export default function RouteGuard({ children, redirectTo = "/login" }: RouteGuardProps) {
  const [, setLocation] = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      const isAuthenticated = authService.isAuthenticated();
      
      if (!isAuthenticated) {
        console.log('🔒 ROUTE_GUARD: User not authenticated, redirecting to:', redirectTo);
        // Use window.location.href instead of setLocation for better deployment compatibility
        window.location.href = redirectTo;
        return;
      }

      // If authenticated, ensure we have user data
      try {
        await authService.getCurrentUser();
        setIsChecking(false);
      } catch (error) {
        console.error('🔒 ROUTE_GUARD: Auth check failed:', error);
        window.location.href = redirectTo;
      }
    };

    checkAuthAndRedirect();

    // Listen for auth changes
    const handleAuthChange = () => {
      if (!authService.isAuthenticated()) {
        window.location.href = redirectTo;
      } else {
        setIsChecking(false);
      }
    };

    window.addEventListener('auth-change', handleAuthChange);
    window.addEventListener('auth-login-complete', handleAuthChange);

    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('auth-login-complete', handleAuthChange);
    };
  }, [redirectTo, setLocation]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
