import { apiRequest } from './queryClient';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  permissions: any;
  settings: any;
  organizationId: number;
  organizationName: string;
  organizationPlan: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  organizationName: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

class AuthService {
  private token: string | null = null;
  private user: User | null = null;

  constructor() {
    // Always load from localStorage on initialization
    this.token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('auth_user');
    if (userData) {
      try {
        this.user = JSON.parse(userData);
      } catch (error) {
        console.error('Failed to parse user data from localStorage:', error);
        this.clearAuth();
      }
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    this.setAuth(data.token, data.user);
    return data;
  }

  async getCurrentUser(): Promise<User> {
    if (!this.token) {
      throw new Error('No authentication token');
    }

    // Return cached user if available (4-hour strategy)
    if (this.user) {
      console.log('🎯 AUTH: Using cached user data (4-hour strategy)');
      return this.user;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this.clearAuth();
          throw new Error('Session expired');
        }
        // For other errors (500, network), keep cached user if available
        if (this.user) {
          console.log('⚠️ AUTH: Network error, returning cached user data');
          return this.user;
        }
        throw new Error(`Failed to get user data: ${response.status}`);
      }

      const user = await response.json();
      this.user = user;
      localStorage.setItem('auth_user', JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('getCurrentUser error:', error);
      
      // If we have cached user data, use it instead of failing
      if (this.user && error.message !== 'Session expired') {
        console.log('🔄 AUTH: Using cached user data due to network error');
        return this.user;
      }
      
      // Only clear auth and throw on actual auth failures
      throw error;
    }
  }

  logout(): void {
    this.clearAuth();
    // Use navigation instead of window.location to avoid authentication token issues
    setTimeout(() => {
      window.location.href = '/login';
    }, 100);
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): User | null {
    return this.user;
  }

  hasRole(role: string): boolean {
    return this.user?.role === role;
  }

  hasAnyRole(roles: string[]): boolean {
    return this.user ? roles.includes(this.user.role) : false;
  }

  canAccessOrganization(orgId: number): boolean {
    if (this.hasRole('super_admin')) return true;
    return this.user?.organizationId === orgId;
  }

  isSuperAdmin(): boolean {
    return this.hasRole('super_admin');
  }

  isOrgAdmin(): boolean {
    return this.hasRole('org_admin');
  }

  isManager(): boolean {
    return this.hasAnyRole(['manager', 'team_lead']);
  }

  private setAuth(token: string, user: User): void {
    this.token = token;
    this.user = user;
    localStorage.setItem('authToken', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    
    // Trigger auth change event
    window.dispatchEvent(new CustomEvent('auth-change'));
  }

  clearAuth(): void {
    this.token = null;
    this.user = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('auth_user');
    
    // Trigger auth change event
    window.dispatchEvent(new CustomEvent('auth-change'));
  }
}

export const authService = new AuthService();

// Add authorization header to all API requests
export function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}