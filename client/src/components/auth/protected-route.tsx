import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { authService, type User } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredPermissions?: string[];
}

export default function ProtectedRoute({ 
  children, 
  requiredRoles = [],
  requiredPermissions = []
}: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      if (!authService.isAuthenticated()) {
        setLocation('/login');
        return;
      }

      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);

      // Check role requirements
      if (requiredRoles.length > 0 && !authService.hasAnyRole(requiredRoles)) {
        setLocation('/unauthorized');
        return;
      }

      // Check permission requirements
      if (requiredPermissions.length > 0) {
        const hasPermissions = requiredPermissions.every(permission => {
          return currentUser.permissions && currentUser.permissions[permission];
        });
        
        if (!hasPermissions) {
          setLocation('/unauthorized');
          return;
        }
      }

      setIsAuthorized(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      setLocation('/login');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center animate-pulse">
              <Building2 className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}