import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProtectedRoute from "@/components/auth/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Building2, 
  Users, 
  Eye,
  Copy,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface OrganizationData {
  id: number;
  name: string;
  subdomain: string;
  plan: string;
  status: 'active' | 'pending' | 'suspended';
  createdAt: string;
  adminUser?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    lastLoginAt?: string;
  } | null;
  temporaryCredentials?: {
    email: string;
    password: string;
    loginUrl: string;
  };
  userCount: number;
}

export default function OnboardingDashboard() {
  const user = authService.getUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrg, setSelectedOrg] = useState<OrganizationData | null>(null);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Form state for creating organization
  const [createOrgForm, setCreateOrgForm] = useState({
    organizationName: '',
    website: '',
    industry: '',
    size: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });

  // Fetch organizations with stats
  const { data: organizationsData, isLoading } = useQuery<{ organizations: OrganizationData[], pagination: any }>({
    queryKey: ['/api/auth/organizations', currentPage, pageSize],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/auth/organizations?page=${currentPage}&limit=${pageSize}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch organizations');
      return res.json();
    },
  });

  const organizations = organizationsData;

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (orgData: any) => {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/invite-organization-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(orgData),
      });
      if (!res.ok) throw new Error('Failed to create organization');
      return res.json();
    },
    onSuccess: (data) => {
      // Store credentials and show them
      setSelectedOrg({
        ...data.organization,
        adminUser: data.adminUser,
        temporaryCredentials: data.temporaryCredentials,
        userCount: 1,
        status: 'pending' as const,
        createdAt: new Date().toISOString()
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/auth/organizations'] });
      
      toast({
        title: "Organization Created",
        description: `Organization "${data.organization.name}" created successfully.`,
      });
      
      setCreateOrgOpen(false);
      setCredentialsDialogOpen(true);
      
      // Reset form
      setCreateOrgForm({
        organizationName: '',
        website: '',
        industry: '',
        size: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
      });
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create organization. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Filter organizations - Only show onboarding phase organizations
  const filteredOrganizations = organizations?.organizations?.filter(org => {
    // Only show organizations that haven't completed onboarding
    const isOnboarding = !org.adminUser?.lastLoginAt || org.status !== 'active';
    
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         org.adminUser?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Updated filter logic for onboarding dashboard
    let matchesStatus = true;
    if (statusFilter === 'pending') {
      matchesStatus = org.status !== 'active';
    } else if (statusFilter === 'active') {
      matchesStatus = org.status === 'active' && !org.adminUser?.lastLoginAt;
    }
    // 'all' shows all onboarding organizations
    
    return isOnboarding && matchesSearch && matchesStatus;
  }) || [];

  const handleCreateOrg = () => {
    createOrgMutation.mutate(createOrgForm);
  };

  const copyCredentials = (credentials: any) => {
    const credentialsText = `Organization Login Credentials
Organization Name: ${selectedOrg?.name || 'N/A'}
Email: ${credentials.email}
Password: ${credentials.password}
Login URL: ${credentials.loginUrl}

Please change your password after first login.`;
    
    navigator.clipboard.writeText(credentialsText);
    toast({
      title: "Credentials Copied",
      description: "Login credentials copied to clipboard",
    });
  };

  const getStatusBadge = (status: string, lastLogin?: string) => {
    if (status === 'active' && lastLogin) {
      return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    } else if (status === 'active' && !lastLogin) {
      return <Badge className="bg-yellow-100 text-yellow-800">Pending Login</Badge>;
    } else if (status === 'suspended') {
      return <Badge className="bg-red-100 text-red-800">Suspended</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
  };

  const getStatusIcon = (status: string, lastLogin?: string) => {
    if (status === 'active' && lastLogin) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    } else if (status === 'active' && !lastLogin) {
      return <Clock className="w-4 h-4 text-yellow-600" />;
    } else if (status === 'suspended') {
      return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
    return <Clock className="w-4 h-4 text-gray-600" />;
  };

  return (
    <ProtectedRoute requiredRoles={["super_admin"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Organization Onboarding Dashboard
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Track organizations currently in the onboarding process
            </p>
          </div>

          {/* Onboarding-Focused Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Building2 className="w-8 h-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Organizations Onboarding</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {filteredOrganizations.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Clock className="w-8 h-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Awaiting First Login</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {filteredOrganizations.filter(org => !org.adminUser?.lastLoginAt).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <AlertCircle className="w-8 h-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Setup Incomplete</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {filteredOrganizations.filter(org => org.status !== 'active').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Onboarding Users</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {filteredOrganizations.reduce((acc, org) => acc + org.userCount, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search organizations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Onboarding</SelectItem>
                      <SelectItem value="pending">Setup Incomplete</SelectItem>
                      <SelectItem value="active">Awaiting First Login</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Dialog open={createOrgOpen} onOpenChange={setCreateOrgOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Organization
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create New Organization</DialogTitle>
                      <DialogDescription>
                        Set up a new organization and invite its administrator
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6">
                      {/* Organization Details */}
                      <div className="space-y-4">
                        <h5 className="font-semibold text-sm border-b pb-2">Organization Details</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="orgName">Organization Name *</Label>
                            <Input
                              id="orgName"
                              value={createOrgForm.organizationName}
                              onChange={(e) => setCreateOrgForm(prev => ({ ...prev, organizationName: e.target.value }))}
                              placeholder="ACME Corporation"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="orgWebsite">Website</Label>
                            <Input
                              id="orgWebsite"
                              value={createOrgForm.website}
                              onChange={(e) => setCreateOrgForm(prev => ({ ...prev, website: e.target.value }))}
                              placeholder="https://acme.com"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="orgIndustry">Industry</Label>
                            <Select
                              value={createOrgForm.industry}
                              onValueChange={(value) => setCreateOrgForm(prev => ({ ...prev, industry: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select industry" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="technology">Technology</SelectItem>
                                <SelectItem value="finance">Finance</SelectItem>
                                <SelectItem value="healthcare">Healthcare</SelectItem>
                                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                                <SelectItem value="retail">Retail</SelectItem>
                                <SelectItem value="consulting">Consulting</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="orgSize">Company Size</Label>
                            <Select
                              value={createOrgForm.size}
                              onValueChange={(value) => setCreateOrgForm(prev => ({ ...prev, size: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select size" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1-10">1-10 employees</SelectItem>
                                <SelectItem value="11-50">11-50 employees</SelectItem>
                                <SelectItem value="51-200">51-200 employees</SelectItem>
                                <SelectItem value="201-500">201-500 employees</SelectItem>
                                <SelectItem value="501-1000">501-1000 employees</SelectItem>
                                <SelectItem value="1000+">1000+ employees</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Admin Details */}
                      <div className="space-y-4">
                        <h5 className="font-semibold text-sm border-b pb-2">Organization Administrator</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="adminFirstName">First Name *</Label>
                            <Input
                              id="adminFirstName"
                              value={createOrgForm.firstName}
                              onChange={(e) => setCreateOrgForm(prev => ({ ...prev, firstName: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="adminLastName">Last Name *</Label>
                            <Input
                              id="adminLastName"
                              value={createOrgForm.lastName}
                              onChange={(e) => setCreateOrgForm(prev => ({ ...prev, lastName: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="adminEmail">Email Address *</Label>
                            <Input
                              id="adminEmail"
                              type="email"
                              value={createOrgForm.email}
                              onChange={(e) => setCreateOrgForm(prev => ({ ...prev, email: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="adminPhone">Phone Number</Label>
                            <Input
                              id="adminPhone"
                              value={createOrgForm.phone}
                              onChange={(e) => setCreateOrgForm(prev => ({ ...prev, phone: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setCreateOrgOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleCreateOrg}
                          disabled={createOrgMutation.isPending || !createOrgForm.organizationName || !createOrgForm.firstName || !createOrgForm.email}
                        >
                          {createOrgMutation.isPending ? "Creating..." : "Create & Invite"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Organizations Table */}
          <Card>
            <CardHeader>
              <CardTitle>Organizations</CardTitle>
              <CardDescription>
                Manage and monitor all organization onboarding processes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading organizations...</div>
              ) : filteredOrganizations.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No organizations found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Organization</th>
                        <th className="text-left py-3 px-4">Administrator</th>
                        <th className="text-left py-3 px-4">Status</th>
                        <th className="text-left py-3 px-4">Users</th>
                        <th className="text-left py-3 px-4">Created</th>
                        <th className="text-left py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrganizations.map((org) => (
                        <tr key={org.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-4 px-4">
                            <div>
                              <div className="font-medium">{org.name}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {org.subdomain}.aimhi.app
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div>
                              <div className="font-medium">
                                {org.adminUser?.firstName || 'N/A'} {org.adminUser?.lastName || ''}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {org.adminUser?.email || 'N/A'}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(org.status, org.adminUser?.lastLoginAt)}
                              {getStatusBadge(org.status, org.adminUser?.lastLoginAt)}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant="outline">{org.userCount} users</Badge>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm">
                              {new Date(org.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedOrg(org);
                                  setCredentialsDialogOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              {organizationsData?.pagination && (
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

          {/* Credentials Dialog */}
          <Dialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Organization Login Credentials</DialogTitle>
                <DialogDescription>
                  Share these credentials with the organization administrator
                </DialogDescription>
              </DialogHeader>
              {selectedOrg && (
                <div className="space-y-4">
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Organization</Label>
                      <p className="text-sm">{selectedOrg.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Administrator</Label>
                      <p className="text-sm">{selectedOrg.adminUser?.firstName || 'N/A'} {selectedOrg.adminUser?.lastName || ''}</p>
                    </div>
                    {selectedOrg.temporaryCredentials && (
                      <>
                        <div>
                          <Label className="text-sm font-medium">Email (Username)</Label>
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-mono">{selectedOrg.temporaryCredentials.email}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigator.clipboard.writeText(selectedOrg.temporaryCredentials!.email)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Temporary Password</Label>
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-mono">{selectedOrg.temporaryCredentials.password}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigator.clipboard.writeText(selectedOrg.temporaryCredentials!.password)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Login URL</Label>
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-mono text-blue-600">{selectedOrg.temporaryCredentials.loginUrl}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigator.clipboard.writeText(selectedOrg.temporaryCredentials!.loginUrl)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {selectedOrg.temporaryCredentials && (
                    <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded-lg">
                      <p className="text-sm text-orange-800 dark:text-orange-200">
                        <strong>Important:</strong> The administrator should change their password immediately after first login.
                      </p>
                    </div>
                  )}
                  
                  <div className="flex justify-between space-x-2">
                    {selectedOrg.temporaryCredentials && (
                      <Button
                        variant="outline"
                        onClick={() => copyCredentials(selectedOrg.temporaryCredentials)}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy All
                      </Button>
                    )}
                    <Button onClick={() => setCredentialsDialogOpen(false)}>
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </ProtectedRoute>
  );
}