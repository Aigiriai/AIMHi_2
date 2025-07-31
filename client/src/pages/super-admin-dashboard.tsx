import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProtectedRoute from "@/components/auth/protected-route";
import Navbar from "@/components/navigation/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
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
  CreditCard,
  Database,
  Trash2,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { authService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch organizations with pagination
  const { data: organizationsData, isLoading: orgsLoading } = useQuery({
    queryKey: ['/api/auth/organizations', currentPage, pageSize],
    queryFn: async () => {
      const token = authService.getToken();
      const response = await fetch(`/api/auth/organizations?page=${currentPage}&limit=${pageSize}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }
      
      const data = await response.json();
      return data;
    },
  });

  // Fetch all organizations for stats calculation (without pagination)
  const { data: allOrganizationsData } = useQuery({
    queryKey: ['/api/auth/organizations-all'],
    queryFn: async () => {
      const token = authService.getToken();
      const response = await fetch(`/api/auth/organizations?page=1&limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch all organizations');
      }
      
      const data = await response.json();
      return data;
    },
  });

  const organizations = organizationsData?.organizations || [];
  const allOrganizations = allOrganizationsData?.organizations || [];

  // Database reset mutations
  const resetDevelopmentDB = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/admin/database/reset-development');
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Development Database Reset",
        description: `Database reset successfully. Backup created: ${data.backup}`,
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries();
      // Suggest page refresh since database was reset
      toast({
        title: "Page Refresh Required",
        description: "Please refresh the page to see the changes.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Reset Failed",
        description: error.message || "Failed to reset development database",
        variant: "destructive",
      });
    },
  });

  const resetProductionDB = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/admin/database/reset-production');
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Production Database Reset",
        description: `Database reset successfully. Backup created: ${data.backup}`,
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries();
      // Suggest page refresh since database was reset
      toast({
        title: "Page Refresh Required",
        description: "Please refresh the page to see the changes.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Reset Failed",
        description: error.message || "Failed to reset production database",
        variant: "destructive",
      });
    },
  });

  const filteredOrganizations = organizations.filter((org: Organization) =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.domain?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Use pagination totalOrganizations for accurate counts
  const totalOrganizations = organizationsData?.pagination?.totalOrganizations || 0;
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

          {/* Database Management Section */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Management
                  </CardTitle>
                  <CardDescription>
                    Reset development or production databases (creates backup before deletion)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Development Database Reset */}
                <div className="border rounded-lg p-4 bg-blue-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-blue-600" />
                    <h3 className="font-medium text-blue-900">Development Database</h3>
                  </div>
                  <p className="text-sm text-blue-700 mb-4">
                    Resets the development database. Safe for testing and development work.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-blue-300 text-blue-700 hover:bg-blue-100"
                        disabled={resetDevelopmentDB.isPending}
                      >
                        {resetDevelopmentDB.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Resetting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Reset Development DB
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-orange-500" />
                          Reset Development Database?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the development database and create a fresh one. 
                          A backup will be created automatically before deletion. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => resetDevelopmentDB.mutate()}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          Reset Development Database
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {/* Production Database Reset */}
                <div className="border rounded-lg p-4 bg-red-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-red-600" />
                    <h3 className="font-medium text-red-900">Production Database</h3>
                  </div>
                  <p className="text-sm text-red-700 mb-4">
                    ⚠️ DANGER: Resets the production database. All live data will be lost!
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={resetProductionDB.isPending}
                      >
                        {resetProductionDB.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Resetting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Reset Production DB
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="h-5 w-5" />
                          DANGER: Reset Production Database?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-red-800">
                          <div>
                            <strong>This will permanently delete ALL production data including:</strong>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              <li>All organizations and users</li>
                              <li>All job postings and candidates</li>
                              <li>All AI matches and applications</li>
                              <li>All settings and configurations</li>
                            </ul>
                            <div className="mt-3 font-semibold">
                              A backup will be created, but this action is IRREVERSIBLE.
                            </div>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => resetProductionDB.mutate()}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          I understand - Reset Production Database
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>

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