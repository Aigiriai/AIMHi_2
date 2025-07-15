import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import ProtectedRoute from "@/components/auth/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  Users, 
  Plus,
  Search,
  MoreHorizontal,
  Settings,
  Trash2,
  Edit
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
  timezone?: string;
  dateFormat?: string;
  currency?: string;
}

export default function OrganizationsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteUserData, setDeleteUserData] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editOrgForm, setEditOrgForm] = useState({ 
    name: "", 
    domain: "", 
    timezone: "UTC", 
    dateFormat: "MM/DD/YYYY", 
    currency: "USD" 
  });
  const { toast } = useToast();

  const { data: organizationsData, isLoading } = useQuery({
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

  const organizations = organizationsData?.organizations || [];

  // Update organization mutation for the gear button dialog
  const updateOrganizationMutation = useMutation({
    mutationFn: async ({ orgId, name, domain, timezone, dateFormat, currency }: { 
      orgId: number, 
      name: string, 
      domain: string, 
      timezone: string, 
      dateFormat: string, 
      currency: string 
    }) => {
      const token = authService.getToken();
      const response = await fetch(`/api/auth/organizations/${orgId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, domain, timezone, dateFormat, currency }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update organization');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/organizations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/organization'] });
      setShowSettingsDialog(false);
      toast({
        title: "Organization Updated",
        description: "Organization details have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update organization details. Please try again.",
        variant: "destructive",
      });
    }
  });

  const deleteOrganizationMutation = useMutation({
    mutationFn: async ({ organizationId, deleteUserData }: { organizationId: number, deleteUserData: boolean }) => {
      const token = authService.getToken();
      const response = await fetch(`/api/auth/organizations/${organizationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deleteUserData }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete organization');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/organizations'] });
      toast({ 
        title: "Organization Deleted", 
        description: `${selectedOrg?.name} has been successfully deleted.`,
        variant: "destructive" 
      });
      setShowDeleteDialog(false);
      setSelectedOrg(null);
      
      // If user deleted their own organization, redirect to login
      const currentUser = authService.getUser();
      if (currentUser && selectedOrg && currentUser.organizationId === selectedOrg.id) {
        authService.logout();
        window.location.href = '/login';
      }
    },
    onError: () => {
      toast({ 
        title: "Delete Failed", 
        description: "Failed to delete organization. Please try again.",
        variant: "destructive" 
      });
    },
  });

  const filteredOrganizations = organizations.filter((org: Organization) =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.domain?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
                <p className="text-gray-600">Manage all platform organizations and their settings</p>
              </div>
            </div>
          </div>

          {/* Organizations Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Organizations</CardTitle>
                  <CardDescription>
                    View and manage organizations using the AIM Hi platform
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
              {isLoading ? (
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
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrganizations.map((org: Organization) => (
                      <TableRow key={org.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium">{org.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {org.domain || org.subdomain}
                              </div>
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
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span>{org.userCount}</span>
                          </div>
                        </TableCell>
                        <TableCell>{org.teamCount}</TableCell>
                        <TableCell>
                          {new Date(org.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Dialog open={showSettingsDialog && selectedOrg?.id === org.id} onOpenChange={setShowSettingsDialog}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => { 
                                  setSelectedOrg(org); 
                                  setEditOrgForm({ 
                                    name: org.name, 
                                    domain: org.domain || org.subdomain,
                                    timezone: org.timezone || "UTC",
                                    dateFormat: org.dateFormat || "MM/DD/YYYY",
                                    currency: org.currency || "USD"
                                  });
                                  setShowSettingsDialog(true); 
                                }}>
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Organization Settings</DialogTitle>
                                  <DialogDescription>
                                    Configure advanced settings and permissions for {selectedOrg?.name}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-6 py-4">
                                  {/* Basic Organization Details */}
                                  <div className="space-y-4">
                                    <h3 className="text-lg font-medium">Organization Details</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">Organization Name</label>
                                        <Input 
                                          value={editOrgForm.name}
                                          onChange={(e) => setEditOrgForm({...editOrgForm, name: e.target.value})}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">Domain</label>
                                        <Input 
                                          value={editOrgForm.domain}
                                          onChange={(e) => setEditOrgForm({...editOrgForm, domain: e.target.value})}
                                        />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">Status</label>
                                        <select className="w-full p-2 border rounded" defaultValue={selectedOrg?.status}>
                                          <option value="active">Active</option>
                                          <option value="suspended">Suspended</option>
                                          <option value="cancelled">Cancelled</option>
                                        </select>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">Created</label>
                                        <Input value={selectedOrg?.createdAt ? new Date(selectedOrg.createdAt).toLocaleDateString() : ""} readOnly />
                                      </div>
                                    </div>
                                    
                                    {/* Organization Preferences */}
                                    <div className="grid grid-cols-3 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">Timezone</label>
                                        <select 
                                          className="w-full p-2 border rounded" 
                                          value={editOrgForm.timezone}
                                          onChange={(e) => setEditOrgForm({...editOrgForm, timezone: e.target.value})}
                                        >
                                          <option value="UTC">UTC</option>
                                          <option value="America/New_York">Eastern Time</option>
                                          <option value="America/Chicago">Central Time</option>
                                          <option value="America/Denver">Mountain Time</option>
                                          <option value="America/Los_Angeles">Pacific Time</option>
                                          <option value="Europe/London">London</option>
                                          <option value="Europe/Paris">Paris</option>
                                          <option value="Asia/Tokyo">Tokyo</option>
                                          <option value="Asia/Kolkata">India</option>
                                        </select>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">Date Format</label>
                                        <select 
                                          className="w-full p-2 border rounded" 
                                          value={editOrgForm.dateFormat}
                                          onChange={(e) => setEditOrgForm({...editOrgForm, dateFormat: e.target.value})}
                                        >
                                          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                        </select>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">Currency</label>
                                        <select 
                                          className="w-full p-2 border rounded" 
                                          value={editOrgForm.currency}
                                          onChange={(e) => setEditOrgForm({...editOrgForm, currency: e.target.value})}
                                        >
                                          <option value="USD">USD ($)</option>
                                          <option value="EUR">EUR (€)</option>
                                          <option value="GBP">GBP (£)</option>
                                          <option value="INR">INR (₹)</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Billing & Plan Settings */}
                                  <div className="space-y-4">
                                    <h3 className="text-lg font-medium">Billing & Subscription</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">Current Plan</label>
                                        <select className="w-full p-2 border rounded" defaultValue={selectedOrg?.plan}>
                                          <option value="starter">Starter - $29/month</option>
                                          <option value="professional">Professional - $99/month</option>
                                          <option value="enterprise">Enterprise - $299/month</option>
                                        </select>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">Billing Cycle</label>
                                        <select className="w-full p-2 border rounded">
                                          <option value="monthly">Monthly</option>
                                          <option value="annual">Annual (20% off)</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>

                                  {/* User Management */}
                                  <div className="space-y-4">
                                    <h3 className="text-lg font-medium">User Management</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">User Limit</label>
                                        <Input defaultValue="50" type="number" />
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">Team Limit</label>
                                        <Input defaultValue="10" type="number" />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Security Settings */}
                                  <div className="space-y-4">
                                    <h3 className="text-lg font-medium">Security & Compliance</h3>
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="font-medium">Two-Factor Authentication</div>
                                          <div className="text-sm text-gray-500">Require 2FA for all users</div>
                                        </div>
                                        <input type="checkbox" className="rounded" />
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="font-medium">SSO Integration</div>
                                          <div className="text-sm text-gray-500">Enable single sign-on</div>
                                        </div>
                                        <input type="checkbox" className="rounded" />
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="font-medium">Audit Logging</div>
                                          <div className="text-sm text-gray-500">Track all user actions</div>
                                        </div>
                                        <input type="checkbox" className="rounded" defaultChecked />
                                      </div>
                                    </div>
                                  </div>

                                  {/* API & Integrations */}
                                  <div className="space-y-4">
                                    <h3 className="text-lg font-medium">API & Integrations</h3>
                                    <div className="space-y-3">
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">API Rate Limit</label>
                                        <select className="w-full p-2 border rounded">
                                          <option value="1000">1,000 requests/hour</option>
                                          <option value="5000">5,000 requests/hour</option>
                                          <option value="10000">10,000 requests/hour</option>
                                          <option value="unlimited">Unlimited</option>
                                        </select>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="font-medium">Webhook Notifications</div>
                                          <div className="text-sm text-gray-500">Enable webhook events</div>
                                        </div>
                                        <input type="checkbox" className="rounded" />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex justify-end space-x-2">
                                  <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={() => {
                                      if (selectedOrg && editOrgForm.name && editOrgForm.domain) {
                                        updateOrganizationMutation.mutate({
                                          orgId: selectedOrg.id,
                                          name: editOrgForm.name,
                                          domain: editOrgForm.domain,
                                          timezone: editOrgForm.timezone,
                                          dateFormat: editOrgForm.dateFormat,
                                          currency: editOrgForm.currency
                                        });
                                      }
                                    }}
                                    disabled={updateOrganizationMutation.isPending || !editOrgForm.name || !editOrgForm.domain}
                                  >
                                    {updateOrganizationMutation.isPending ? "Saving..." : "Save Settings"}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            
                            <AlertDialog open={showDeleteDialog && selectedOrg?.id === org.id} onOpenChange={setShowDeleteDialog}>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-red-600 disabled:opacity-50 disabled:cursor-not-allowed" 
                                  onClick={() => { setSelectedOrg(org); setShowDeleteDialog(true); }}
                                  disabled={org.domain === 'platform.aimhi.app'}
                                  title={org.domain === 'platform.aimhi.app' ? 'Cannot delete super admin organization' : 'Delete organization'}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{selectedOrg?.name}"? This action cannot be undone and will permanently remove all associated data.
                                    {selectedOrg?.domain === 'platform.aimhi.app' && (
                                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                                        <strong>Warning:</strong> This is the super admin organization and cannot be deleted.
                                      </div>
                                    )}
                                    {authService.getUser()?.organizationId === selectedOrg?.id && (
                                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
                                        <strong>Notice:</strong> You are deleting your own organization. You will be logged out automatically.
                                      </div>
                                    )}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => {
                                      if (selectedOrg) {
                                        deleteOrganizationMutation.mutate({ 
                                          organizationId: selectedOrg.id, 
                                          deleteUserData: true 
                                        });
                                      }
                                    }} 
                                    className="bg-red-600 hover:bg-red-700"
                                    disabled={deleteOrganizationMutation.isPending}
                                  >
                                    {deleteOrganizationMutation.isPending ? "Deleting..." : "Delete"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}