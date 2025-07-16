import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProtectedRoute from "@/components/auth/protected-route";
import Navbar from "@/components/navigation/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Settings as SettingsIcon, 
  User, 
  Users, 
  Bell,
  Shield,
  CreditCard,
  Globe,
  Save,
  UserPlus,
  Send,
  Copy,
  MoreHorizontal,
  Trash2
} from "lucide-react";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";


export default function SettingsPage() {
  const user = authService.getUser();
  const [activeTab, setActiveTab] = useState("profile");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Modal states
  const [inviteUserOpen, setInviteUserOpen] = useState(false);

  // Form states
  const [newUserData, setNewUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'recruiter'
  });

  // Fetch user settings from database
  const { data: userSettings, isLoading: userLoading } = useQuery<any>({
    queryKey: ['/api/settings/user'],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/settings/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch user settings');
      return res.json();
    }
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Fetch users
  const { data: usersData } = useQuery<{users: any[], pagination: any}>({
    queryKey: ['/api/users', currentPage, pageSize],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/users?page=${currentPage}&limit=${pageSize}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    staleTime: 0, // Always refetch to ensure fresh data
    gcTime: 0     // Don't cache the data (React Query v5 uses gcTime instead of cacheTime)
  });

  const users = usersData?.users || [];
  const pagination = usersData?.pagination || {};

  // Fetch current user data to ensure consistency
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: () => authService.getCurrentUser(),
  });

  // Local settings state - use currentUser data for consistency
  const [localUserSettings, setLocalUserSettings] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    theme: userSettings?.theme || 'system',
    language: userSettings?.language || 'en',
    notifications: userSettings?.notifications || {
      email: true,
      push: true,
      sms: false
    }
  });

  // Update local settings when currentUser data changes
  useEffect(() => {
    if (currentUser) {
      setLocalUserSettings(prev => ({
        ...prev,
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
      }));
    }
  }, [currentUser]);

  // Update user profile
  const profileMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    }
  });

  // User invite mutation
  const inviteUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to invite user');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "User Invited",
        description: "User invitation sent successfully.",
      });
      setInviteUserOpen(false);
      setNewUserData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: 'recruiter'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to invite user.",
        variant: "destructive",
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete user');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "User Deleted",
        description: "User has been successfully removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete user.",
        variant: "destructive",
      });
    }
  });



  const handleUserSettingChange = (key: string, value: any) => {
    setLocalUserSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const saveProfile = () => {
    profileMutation.mutate({
      firstName: localUserSettings.firstName,
      lastName: localUserSettings.lastName,
      email: localUserSettings.email,
      phone: localUserSettings.phone,
    });
  };

  const inviteUser = () => {
    inviteUserMutation.mutate(newUserData);
  };



  // Role checks
  const isSuperAdmin = user?.role === 'super_admin';
  const isOrgAdmin = user?.role === 'org_admin';
  const isManager = user?.role === 'manager';
  const isTeamLead = user?.role === 'team_lead';

  const getAllowedInviteRoles = () => {
    if (isSuperAdmin) return ['org_admin'];
    if (isOrgAdmin) return ['manager', 'team_lead', 'recruiter'];
    if (isManager) return ['team_lead', 'recruiter'];
    if (isTeamLead) return ['recruiter'];
    return [];
  };

  const allowedRoles = getAllowedInviteRoles();
  const canInviteUsers = allowedRoles.length > 0;

  const tabs = [
    { value: "profile", label: "Profile", icon: User, roles: ["super_admin", "org_admin", "manager", "team_lead", "recruiter"] },
    { value: "users", label: "Users & Teams", icon: Users, roles: ["super_admin", "org_admin", "manager"] },
    { value: "notifications", label: "Notifications", icon: Bell, roles: ["super_admin", "org_admin", "manager", "team_lead", "recruiter"] },
    { value: "security", label: "Security", icon: Shield, roles: ["super_admin", "org_admin"] },
    { value: "billing", label: "Billing", icon: CreditCard, roles: ["super_admin", "org_admin"] },
    { value: "integrations", label: "Integrations", icon: Globe, roles: ["super_admin", "org_admin"] },
  ];

  const availableTabs = tabs.filter(tab => tab.roles.includes(user?.role || ''));

  if (userLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse">Loading settings...</div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-2">
              <SettingsIcon className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            </div>
            <p className="text-gray-600">Platform configuration and management settings</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6 mb-8">
              {availableTabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger 
                    key={tab.value} 
                    value={tab.value}
                    className="flex items-center space-x-2"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Profile Settings */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your personal information and account settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input 
                        id="firstName" 
                        value={localUserSettings.firstName}
                        onChange={(e) => handleUserSettingChange('firstName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input 
                        id="lastName" 
                        value={localUserSettings.lastName}
                        onChange={(e) => handleUserSettingChange('lastName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        value={localUserSettings.email}
                        onChange={(e) => handleUserSettingChange('email', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input 
                        id="phone" 
                        value={localUserSettings.phone}
                        onChange={(e) => handleUserSettingChange('phone', e.target.value)}
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={saveProfile}
                    disabled={profileMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {profileMutation.isPending ? "Saving..." : "Save Profile"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Users & Teams */}
            {(isSuperAdmin || isOrgAdmin || user?.role === 'manager') && (
              <TabsContent value="users">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Team Management</CardTitle>
                      <CardDescription>Manage teams and invite users to your organization</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Active Users</h4>
                          <p className="text-sm text-muted-foreground">
                            {isSuperAdmin ? "Create new organizations and manage administrators" : 
                             isOrgAdmin ? "Invite managers, team leads, and recruiters" :
                             isManager ? "Invite team leads and recruiters" :
                             isTeamLead ? "Invite recruiters to your team" : "View team members"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {/* User Invites */}
                          {canInviteUsers && (
                            <Dialog open={inviteUserOpen} onOpenChange={setInviteUserOpen}>
                              <DialogTrigger asChild>
                                <Button>
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  Invite User
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Invite User</DialogTitle>
                                  <DialogDescription>
                                    Invite a new user to your organization
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="firstName">First Name</Label>
                                      <Input 
                                        id="firstName" 
                                        placeholder="Jane"
                                        value={newUserData.firstName}
                                        onChange={(e) => setNewUserData({...newUserData, firstName: e.target.value})}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="lastName">Last Name</Label>
                                      <Input 
                                        id="lastName" 
                                        placeholder="Doe"
                                        value={newUserData.lastName}
                                        onChange={(e) => setNewUserData({...newUserData, lastName: e.target.value})}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input 
                                      id="email" 
                                      type="email"
                                      placeholder="jane@company.com"
                                      value={newUserData.email}
                                      onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input 
                                      id="phone" 
                                      placeholder="+1 (555) 123-4567"
                                      value={newUserData.phone}
                                      onChange={(e) => setNewUserData({...newUserData, phone: e.target.value})}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="role">Role</Label>
                                    <Select
                                      value={newUserData.role}
                                      onValueChange={(value) => setNewUserData({...newUserData, role: value})}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select a role" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {allowedRoles.map(role => (
                                          <SelectItem key={role} value={role}>
                                            {role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setInviteUserOpen(false)}>
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={inviteUser}
                                    disabled={inviteUserMutation.isPending}
                                  >
                                    <Send className="w-4 h-4 mr-2" />
                                    {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div>

                      {/* Users table */}
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Credentials</TableHead>
                              <TableHead>Joined</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {users?.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell className="font-medium">
                                  {user.firstName} {user.lastName}
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                  <Badge variant={user.role === 'super_admin' ? 'destructive' : 'secondary'}>
                                    {user.role.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                                    {user.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {user.temporaryPassword ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center space-x-2">
                                        <Badge variant="outline" className="text-xs">
                                          Temp Password
                                        </Badge>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const credentials = `Organization: ${user.organizationName || 'N/A'}\nEmail: ${user.email}\nPassword: ${user.temporaryPassword}`;
                                            navigator.clipboard.writeText(credentials);
                                            toast({
                                              title: "Credentials Copied",
                                              description: "Login credentials with organization copied to clipboard",
                                            });
                                          }}
                                        >
                                          <Copy className="w-3 h-3" />
                                        </Button>
                                      </div>
                                      <p className="text-xs text-muted-foreground font-mono">
                                        {user.temporaryPassword}
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">Set by user</span>
                                  )}
                                </TableCell>
                                <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" className="h-8 w-8 p-0">
                                        <span className="sr-only">Open menu</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                      {user.temporaryPassword && (
                                        <DropdownMenuItem
                                          onClick={() => {
                                            const credentials = `Organization: ${user.organizationName || 'N/A'}\nEmail: ${user.email}\nPassword: ${user.temporaryPassword}`;
                                            navigator.clipboard.writeText(credentials);
                                            toast({
                                              title: "Credentials Copied",
                                              description: "Login credentials with organization copied to clipboard",
                                            });
                                          }}
                                        >
                                          <Copy className="mr-2 h-4 w-4" />
                                          Copy Credentials
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-red-600"
                                        onClick={() => {
                                          if (confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}?`)) {
                                            deleteUserMutation.mutate(user.id);
                                          }
                                        }}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete User
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      
                      {/* Pagination Controls */}
                      {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                          <div className="text-sm text-muted-foreground">
                            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.totalUsers)} of {pagination.totalUsers} users
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(currentPage - 1)}
                              disabled={!pagination.hasPrev}
                            >
                              Previous
                            </Button>
                            <div className="flex items-center space-x-1">
                              <span className="text-sm text-muted-foreground">
                                Page {pagination.page} of {pagination.totalPages}
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(currentPage + 1)}
                              disabled={!pagination.hasNext}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            {/* Notifications */}
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>Configure how you receive notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive notifications via email
                        </p>
                      </div>
                      <Switch
                        checked={localUserSettings.notifications.email}
                        onCheckedChange={(checked) =>
                          handleUserSettingChange('notifications', {
                            ...localUserSettings.notifications,
                            email: checked
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Push Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive push notifications in browser
                        </p>
                      </div>
                      <Switch
                        checked={localUserSettings.notifications.push}
                        onCheckedChange={(checked) =>
                          handleUserSettingChange('notifications', {
                            ...localUserSettings.notifications,
                            push: checked
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>SMS Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive notifications via SMS
                        </p>
                      </div>
                      <Switch
                        checked={localUserSettings.notifications.sms}
                        onCheckedChange={(checked) =>
                          handleUserSettingChange('notifications', {
                            ...localUserSettings.notifications,
                            sms: checked
                          })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security */}
            {(isSuperAdmin || isOrgAdmin) && (
              <TabsContent value="security">
                <Card>
                  <CardHeader>
                    <CardTitle>Security Settings</CardTitle>
                    <CardDescription>Manage account security and access controls</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Security settings will be available soon.</p>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Billing */}
            {(isSuperAdmin || isOrgAdmin) && (
              <TabsContent value="billing">
                <Card>
                  <CardHeader>
                    <CardTitle>Billing & Subscription</CardTitle>
                    <CardDescription>Manage your subscription and billing information</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Billing settings will be available soon.</p>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Integrations */}
            {(isSuperAdmin || isOrgAdmin) && (
              <TabsContent value="integrations">
                <Card>
                  <CardHeader>
                    <CardTitle>Integrations</CardTitle>
                    <CardDescription>Connect with external services and platforms</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Integrations will be available soon.</p>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  );
}