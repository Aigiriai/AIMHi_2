import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ProtectedRoute from "@/components/auth/protected-route";
import Navbar from "@/components/navigation/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Settings,
  CreditCard
} from "lucide-react";
import { authService } from "@/lib/auth";

interface Organization {
  id: number;
  name: string;
  domain: string;
  subdomain: string;
  plan: string;
  status: string;
  userCount: number;
  teamCount: number;
  monthlyUsage: any[];
  createdAt: string;
}

export default function SuperAdminDashboard() {
  console.log(`🚀 CLIENT: SuperAdminDashboard component mounted`);
  console.log(`🚀 CLIENT: Current URL:`, window.location.href);
  console.log(`🚀 CLIENT: User agent:`, navigator.userAgent);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  console.log(`🔄 CLIENT: SuperAdminDashboard state:`, { currentPage, pageSize });

  // Fetch organizations with pagination
  const { data: organizationsData, isLoading: orgsLoading, error: orgsError } = useQuery({
    queryKey: ['/api/auth/organizations', currentPage, pageSize],
    queryFn: async () => {
      const requestId = Math.random().toString(36).substr(2, 9);
      console.log(`🔄 CLIENT[${requestId}]: ============= FETCHING ORGANIZATIONS =============`);
      console.log(`🔄 CLIENT[${requestId}]: Request params:`, { currentPage, pageSize });
      
      const token = authService.getToken();
      console.log(`🔄 CLIENT[${requestId}]: Token available:`, !!token);
      console.log(`🔄 CLIENT[${requestId}]: Token length:`, token?.length || 0);
      
      const url = `/api/auth/organizations?page=${currentPage}&limit=${pageSize}`;
      console.log(`🔄 CLIENT[${requestId}]: Fetching URL:`, url);
      console.log(`🔄 CLIENT[${requestId}]: Base URL:`, window.location.origin);
      console.log(`🔄 CLIENT[${requestId}]: Full URL:`, window.location.origin + url);
      
      const fetchStart = Date.now();
      
      try {
        console.log(`📤 CLIENT[${requestId}]: Sending fetch request...`);
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        const fetchTime = Date.now() - fetchStart;
        console.log(`📥 CLIENT[${requestId}]: Response received in ${fetchTime}ms`);
        console.log(`📥 CLIENT[${requestId}]: Response status:`, response.status, response.statusText);
        console.log(`📥 CLIENT[${requestId}]: Response headers:`, Object.fromEntries(response.headers.entries()));
        console.log(`📥 CLIENT[${requestId}]: Response ok:`, response.ok);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ CLIENT[${requestId}]: HTTP Error:`, {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          throw new Error(`Failed to fetch organizations: ${response.status} ${response.statusText}`);
        }
        
        console.log(`📋 CLIENT[${requestId}]: Parsing JSON response...`);
        const parseStart = Date.now();
        const data = await response.json();
        const parseTime = Date.now() - parseStart;
        
        console.log(`✅ CLIENT[${requestId}]: JSON parsed in ${parseTime}ms`);
        console.log(`✅ CLIENT[${requestId}]: Response data:`, {
          organizationCount: data.organizations?.length || 0,
          pagination: data.pagination,
          totalSize: JSON.stringify(data).length
        });
        console.log(`🔄 CLIENT[${requestId}]: ============= FETCH SUCCESS =============`);
        
        return data;
      } catch (error: any) {
        const fetchTime = Date.now() - fetchStart;
        console.error(`❌ CLIENT[${requestId}]: Fetch failed after ${fetchTime}ms:`, {
          error: error.message,
          type: error.constructor.name,
          stack: error.stack?.split('\n').slice(0, 3)
        });
        console.log(`🔄 CLIENT[${requestId}]: ============= FETCH ERROR =============`);
        throw error;
      }
    },
    retry: (failureCount, error) => {
      console.log(`🔄 CLIENT: Retry attempt ${failureCount} for organizations fetch:`, error.message);
      return failureCount < 3; // Retry up to 3 times
    },
    retryDelay: (attemptIndex) => {
      const delay = Math.min(1000 * 2 ** attemptIndex, 30000);
      console.log(`⏳ CLIENT: Retrying in ${delay}ms (attempt ${attemptIndex + 1})`);
      return delay;
    }
  });

  // Fetch all organizations for stats calculation (without pagination)
  const { data: allOrganizationsData } = useQuery({
    queryKey: ['/api/auth/organizations-all'],
    queryFn: async () => {
      console.log(`🔄 CLIENT: Fetching all organizations for stats...`);
      const token = authService.getToken();
      const response = await fetch(`/api/auth/organizations?page=1&limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error(`❌ CLIENT: Failed to fetch all organizations:`, response.status, response.statusText);
        throw new Error('Failed to fetch all organizations');
      }
      
      const data = await response.json();
      console.log(`✅ CLIENT: All organizations fetched:`, data.organizations?.length || 0);
      return data;
      return data;
    },
  });

  const organizations = organizationsData?.organizations || [];
  const allOrganizations = allOrganizationsData?.organizations || [];

  const filteredOrganizations = organizations.filter((org: Organization) =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.domain?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Use pagination total for accurate counts
  const totalOrganizations = organizationsData?.pagination?.total || 0;
  const activeOrganizations = allOrganizations.filter((org: Organization) => org.status === 'active').length;
  const totalUsers = allOrganizations.reduce((sum: number, org: Organization) => sum + org.userCount, 0);
  const totalRevenue = totalOrganizations * 500; // Use total organizations for revenue calculation

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      case 'professional':
        return 'bg-blue-100 text-blue-800';
      case 'basic':
        return 'bg-green-100 text-green-800';
      case 'trial':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  console.log(`🔄 CLIENT: SuperAdminDashboard component state:`, {
    orgsLoading,
    orgsError: orgsError?.message,
    organizationsData: !!organizationsData,
    organizationCount: organizationsData?.organizations?.length || 0
  });

  return (
    <ProtectedRoute requiredRoles={['super_admin']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Platform Administration</h1>
                <p className="text-gray-600">Manage all organizations and monitor platform usage</p>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {orgsLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading organizations...</span>
            </div>
          )}

          {/* Error State */}
          {orgsError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Error loading organizations
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    {orgsError.message || 'An unexpected error occurred'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrganizations}</div>
                <p className="text-xs text-muted-foreground">
                  {activeOrganizations} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUsers}</div>
                <p className="text-xs text-muted-foreground">
                  Across all organizations
                </p>
              </CardContent>
            </Card>

            {/* Monthly Revenue and Platform Growth cards removed */}
          </div>

          {/* Organizations Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Organizations</CardTitle>
                  <CardDescription>
                    Manage and monitor all platform organizations
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search organizations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {orgsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Teams</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrganizations.map((org: Organization) => (
                      <TableRow key={org.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{org.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {org.domain || org.subdomain}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPlanBadgeColor(org.plan)}>
                            {org.plan.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(org.status)}>
                            {org.status.charAt(0).toUpperCase() + org.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{org.userCount}</TableCell>
                        <TableCell>{org.teamCount}</TableCell>
                        <TableCell>
                          {new Date(org.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              
              {/* Pagination Controls */}
              {organizationsData?.pagination && organizationsData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span>
                      Showing {((organizationsData.pagination.page - 1) * organizationsData.pagination.limit) + 1} to{' '}
                      {Math.min(organizationsData.pagination.page * organizationsData.pagination.limit, organizationsData.pagination.total)} of{' '}
                      {organizationsData.pagination.total} organizations
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={!organizationsData.pagination.hasPrev}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {organizationsData.pagination.page} of {organizationsData.pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      disabled={!organizationsData.pagination.hasNext}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}