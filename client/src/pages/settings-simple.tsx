import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProtectedRoute from "@/components/auth/protected-route";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  MoreHorizontal,
  Building2
} from "lucide-react";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/navigation/navbar";

export default function SettingsPage() {
  const user = authService.getUser();
  const [activeTab, setActiveTab] = useState("profile");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Modal states
  const [inviteUserOpen, setInviteUserOpen] = useState(false);
  const [inviteOrgAdminOpen, setInviteOrgAdminOpen] = useState(false);

  // Form states
  const [newUserData, setNewUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'recruiter'
  });

  const [newOrgData, setNewOrgData] = useState({
    name: '',
    domain: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPhone: ''
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

  // Fetch users
  const { data: users } = useQuery<any[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    }
  });

  // Local settings state
  const [localUserSettings, setLocalUserSettings] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    theme: userSettings?.theme || 'system',
    language: userSettings?.language || 'en',
    notifications: userSettings?.notifications || {
      email: true,
      push: true,
      sms: false
    }
  });

  // Update user profile
  const profileMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/me', {
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

  // Organization admin invite mutation
  const inviteOrgAdminMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/invite-organization-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create organization');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Organization Created",
        description: "Organization and admin account created successfully.",
      });
      setInviteOrgAdminOpen(false);
      setNewOrgData({
        name: '',
        domain: '',
        adminFirstName: '',
        adminLastName: '',
        adminEmail: '',
        adminPhone: ''
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create organization.",
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

  const inviteOrgAdmin = () => {
    inviteOrgAdminMutation.mutate({
      organizationName: newOrgData.name,
      website: newOrgData.domain,
      firstName: newOrgData.adminFirstName,
      lastName: newOrgData.adminLastName,
      email: newOrgData.adminEmail,
      phone: newOrgData.adminPhone,
    });
  };

  // Role checks
  const isSuperAdmin = user?.role === 'super_admin';
  const isOrgAdmin = user?.role === 'org_admin';
  const isManager = user?.role === 'manager';
  const isTeamLead = user?.role === 'team_lead';

  const getAllowedInviteRoles = () => {
    if (isSuperAdmin) return ['org_admin', 'manager', 'team_lead', 'recruiter'];
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
                          {/* Super Admin: Onboard Organizations */}
                          {isSuperAdmin && (
                            <Dialog open={inviteOrgAdminOpen} onOpenChange={setInviteOrgAdminOpen}>
                              <DialogTrigger asChild>
                                <Button>
                                  <Building2 className="w-4 h-4 mr-2" />
                                  Onboard Organization
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Onboard New Organization</DialogTitle>
                                  <DialogDescription>
                                    Create a new organization and invite its administrator
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-6">
                                  {/* Organization Details */}
                                  <div className="space-y-4">
                                    <h5 className="font-semibold text-sm border-b pb-2 mb-4">Organization Details</h5>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="orgName">Organization Name</Label>
                                        <Input 
                                          id="orgName" 
                                          placeholder="Acme Corporation"
                                          value={newOrgData.name}
                                          onChange={(e) => setNewOrgData({...newOrgData, name: e.target.value})}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="orgDomain">Domain</Label>
                                        <Input 
                                          id="orgDomain" 
                                          placeholder="acme.com"
                                          value={newOrgData.domain}
                                          onChange={(e) => setNewOrgData({...newOrgData, domain: e.target.value})}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  {/* Administrator Details */}
                                  <div className="space-y-4">
                                    <h5 className="font-semibold text-sm border-b pb-2 mb-4">Administrator Details</h5>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="adminFirstName">First Name</Label>
                                        <Input 
                                          id="adminFirstName" 
                                          placeholder="John"
                                          value={newOrgData.adminFirstName}
                                          onChange={(e) => setNewOrgData({...newOrgData, adminFirstName: e.target.value})}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="adminLastName">Last Name</Label>
                                        <Input 
                                          id="adminLastName" 
                                          placeholder="Smith"
                                          value={newOrgData.adminLastName}
                                          onChange={(e) => setNewOrgData({...newOrgData, adminLastName: e.target.value})}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="adminEmail">Email</Label>
                                        <Input 
                                          id="adminEmail" 
                                          type="email"
                                          placeholder="john@acme.com"
                                          value={newOrgData.adminEmail}
                                          onChange={(e) => setNewOrgData({...newOrgData, adminEmail: e.target.value})}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="adminPhone">Phone</Label>
                                        <Input 
                                          id="adminPhone" 
                                          placeholder="+1 (555) 123-4567"
                                          value={newOrgData.adminPhone}
                                          onChange={(e) => setNewOrgData({...newOrgData, adminPhone: e.target.value})}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setInviteOrgAdminOpen(false)}>
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={inviteOrgAdmin}
                                    disabled={inviteOrgAdminMutation.isPending}
                                  >
                                    <Building2 className="w-4 h-4 mr-2" />
                                    {inviteOrgAdminMutation.isPending ? "Creating..." : "Create Organization"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                          
                          {/* Regular User Invites */}
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
                              <TableHead>Actions</TableHead>
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
                                  <Badge variant={user.isActive ? 'default' : 'secondary'}>
                                    {user.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {user.hasTemporaryPassword && user.temporaryPassword ? (
                                    <div className="space-y-1">
                                      <div className="text-xs text-muted-foreground">Temporary Password:</div>
                                      <div className="font-mono text-sm bg-muted p-1 rounded">
                                        {user.temporaryPassword}
                                      </div>
                                      <div className="text-xs text-orange-600">
                                        ⚠️ Share with user to enable login
                                      </div>
                                    </div>
                                  ) : (
                                    <Badge variant="outline">Password Set</Badge>
                                  )}
                                </TableCell>
                                <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" className="h-8 w-8 p-0">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                      {user.hasTemporaryPassword && user.temporaryPassword && (
                                        <DropdownMenuItem 
                                          onClick={() => {
                                            navigator.clipboard.writeText(`Email: ${user.email}\nPassword: ${user.temporaryPassword}`);
                                            toast({
                                              title: "Credentials Copied",
                                              description: "User credentials copied to clipboard.",
                                            });
                                          }}
                                        >
                                          Copy Credentials
                                        </DropdownMenuItem>
                                      )}
                                      {user.id !== authService.getUser()?.id && (
                                        <DropdownMenuItem 
                                          className="text-red-600"
                                          onClick={() => {
                                            if (confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}?`)) {
                                              deleteUserMutation.mutate(user.id);
                                            }
                                          }}
                                        >
                                          Delete User
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
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