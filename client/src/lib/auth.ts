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
    // Only clear auth if it's a fresh browser session (no sessionStorage flag)
    if (!sessionStorage.getItem('auth_session_active')) {
      this.clearAuth();
      sessionStorage.setItem('auth_session_active', 'true');
    } else {
      // Load from localStorage on initialization
      this.token = localStorage.getItem('authToken');
      const userData = localStorage.getItem('auth_user');
      if (userData) {
        try {
          this.user = JSON.parse(userData);
        } catch (error) {
          this.clearAuth();
        }
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

    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.clearAuth();
        window.location.href = '/login';
        throw new Error('Session expired');
      }
      throw new Error('Failed to get user data');
    }

    const user = await response.json();
    this.user = user;
    localStorage.setItem('auth_user', JSON.stringify(user));
    return user;
  }

  logout(): void {
    this.clearAuth();
    sessionStorage.removeItem('auth_session_active');
    window.location.href = '/login';
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

  private clearAuth(): void {
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