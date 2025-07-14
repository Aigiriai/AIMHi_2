import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { 
  Settings as SettingsIcon, 
  User, 
  Building2, 
  Users, 
  Bell,
  Shield,
  CreditCard,
  Globe,
  Database,
  Key,
  Mail,
  Phone,
  Save
} from "lucide-react";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function SettingsPage() {
  const user = authService.getUser();
  const [activeTab, setActiveTab] = useState("profile");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch organization settings from database
  const { data: organizationSettings, isLoading: orgLoading } = useQuery<any>({
    queryKey: ['/api/settings/organization'],
    enabled: user?.role === 'super_admin' || user?.role === 'org_admin',
  });

  // Define fallback user settings first
  const fallbackUserSettings = {
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: "+1-555-0123",
    notifications: {
      email: true,
      browser: true,
      newCandidates: true,
      newMatches: true,
      interviews: true,
      reports: false
    }
  };

  // Fetch user settings from database  
  const { data: fetchedUserSettings, isLoading: userLoading } = useQuery<any>({
    queryKey: ['/api/settings/user'],
  });

  // Merge fetched user settings with fallback
  const userSettingsData = { ...fallbackUserSettings, ...fetchedUserSettings };

  // Organization settings mutation
  const orgMutation = useMutation({
    mutationFn: (settings: any) => fetch('/api/settings/organization', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      },
      body: JSON.stringify(settings),
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/organization'] });
      toast({
        title: "Settings Saved",
        description: "Organization settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Failed to save organization settings. Please try again.",
        variant: "destructive",
      });
    }
  });

  // User settings mutation
  const userMutation = useMutation({
    mutationFn: (settings: any) => fetch('/api/settings/user', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      },
      body: JSON.stringify(settings),
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/user'] });
      toast({
        title: "Settings Saved",
        description: "User settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Failed to save user settings. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleOrgSettingChange = (field: string, value: string) => {
    const updatedSettings = { [field]: value };
    orgMutation.mutate(updatedSettings);
  };

  const handleUserSettingChange = (field: string, value: any) => {
    const updatedSettings = { [field]: value };
    userMutation.mutate(updatedSettings);
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isOrgAdmin = user?.role === 'org_admin';

  const tabs = [
    { value: "profile", label: "Profile", icon: User, roles: ["super_admin", "org_admin", "manager", "team_lead", "recruiter"] },
    { value: "organization", label: "Organization", icon: Building2, roles: ["super_admin", "org_admin"] },
    { value: "users", label: "Users & Teams", icon: Users, roles: ["super_admin", "org_admin", "manager"] },
    { value: "notifications", label: "Notifications", icon: Bell, roles: ["super_admin", "org_admin", "manager", "team_lead", "recruiter"] },
    { value: "security", label: "Security", icon: Shield, roles: ["super_admin", "org_admin"] },
    { value: "billing", label: "Billing", icon: CreditCard, roles: ["super_admin", "org_admin"] },
    { value: "integrations", label: "Integrations", icon: Globe, roles: ["super_admin", "org_admin"] },
  ];

  const visibleTabs = tabs.filter(tab => tab.roles.includes(user?.role || ""));

  return (
    <ProtectedRoute requiredRoles={['super_admin', 'org_admin', 'manager', 'team_lead', 'recruiter']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-600">
                  {isSuperAdmin 
                    ? "Platform configuration and management settings"
                    : "Manage your account and organization preferences"
                  }
                </p>
              </div>
              <Badge variant="outline" className="flex items-center space-x-1">
                <Shield className="w-3 h-3" />
                <span>{user?.role?.replace('_', ' ').toUpperCase()}</span>
              </Badge>
            </div>
          </div>

          {/* Settings Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.value} value={tab.value} className="flex items-center space-x-2">
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
                  <CardDescription>Update your personal account information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" defaultValue={userSettings.firstName} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" defaultValue={userSettings.lastName} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" defaultValue={userSettings.email} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" defaultValue={userSettings.phone} />
                  </div>
                  <Button>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Organization Settings */}
            {(isSuperAdmin || isOrgAdmin) && (
              <TabsContent value="organization">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Organization Details</CardTitle>
                      <CardDescription>Configure your organization settings</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="orgName">Organization Name</Label>
                          <Input 
                            id="orgName" 
                            value={organizationSettings?.name || ""}
                            onChange={(e) => handleOrgSettingChange('name', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="domain">Domain</Label>
                          <Input 
                            id="domain" 
                            value={organizationSettings?.domain || ""}
                            onChange={(e) => handleOrgSettingChange('domain', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="timezone">Timezone</Label>
                          <Select 
                            value={organizationSettings?.timezone || "UTC"}
                            onValueChange={(value) => handleOrgSettingChange('timezone', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="UTC">UTC</SelectItem>
                              <SelectItem value="EST">Eastern Time</SelectItem>
                              <SelectItem value="PST">Pacific Time</SelectItem>
                              <SelectItem value="CST">Central Time</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dateFormat">Date Format</Label>
                          <Select 
                            value={organizationSettings?.dateFormat || "MM/DD/YYYY"}
                            onValueChange={(value) => handleOrgSettingChange('dateFormat', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="currency">Currency</Label>
                          <Select 
                            value={organizationSettings?.currency || "USD"}
                            onValueChange={(value) => handleOrgSettingChange('currency', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD ($)</SelectItem>
                              <SelectItem value="EUR">EUR (€)</SelectItem>
                              <SelectItem value="GBP">GBP (£)</SelectItem>
                              <SelectItem value="INR">INR (₹)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button 
                        onClick={() => orgMutation.mutate({})}
                        disabled={orgMutation.isPending}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {orgMutation.isPending ? "Saving..." : "Save Organization Settings"}
                      </Button>
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
                  <CardDescription>Choose how you want to be notified about important events</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                      </div>
                      <Switch defaultChecked={userSettings.notifications.email} />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Browser Notifications</Label>
                        <p className="text-sm text-muted-foreground">Receive push notifications in browser</p>
                      </div>
                      <Switch defaultChecked={userSettings.notifications.browser} />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>New Candidates</Label>
                        <p className="text-sm text-muted-foreground">Notify when new candidates are added</p>
                      </div>
                      <Switch defaultChecked={userSettings.notifications.newCandidates} />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Interview Reminders</Label>
                        <p className="text-sm text-muted-foreground">Reminders for upcoming interviews</p>
                      </div>
                      <Switch defaultChecked={userSettings.notifications.interviewReminders} />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>System Updates</Label>
                        <p className="text-sm text-muted-foreground">Important platform updates and maintenance</p>
                      </div>
                      <Switch defaultChecked={userSettings.notifications.systemUpdates} />
                    </div>
                  </div>
                  <Button>
                    <Save className="w-4 h-4 mr-2" />
                    Save Notification Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Settings */}
            {(isSuperAdmin || isOrgAdmin) && (
              <TabsContent value="security">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Security Settings</CardTitle>
                      <CardDescription>Manage security and access control settings</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Two-Factor Authentication</Label>
                            <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                          </div>
                          <Button variant="outline">Configure</Button>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Session Timeout</Label>
                            <p className="text-sm text-muted-foreground">Automatically log out inactive users</p>
                          </div>
                          <Select defaultValue="24">
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 hour</SelectItem>
                              <SelectItem value="8">8 hours</SelectItem>
                              <SelectItem value="24">24 hours</SelectItem>
                              <SelectItem value="168">1 week</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Password Policy</Label>
                            <p className="text-sm text-muted-foreground">Minimum security requirements</p>
                          </div>
                          <Button variant="outline">Configure</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            {/* Billing Settings */}
            {(isSuperAdmin || isOrgAdmin) && (
              <TabsContent value="billing">
                <Card>
                  <CardHeader>
                    <CardTitle>Billing & Usage</CardTitle>
                    <CardDescription>Manage your subscription and usage</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Current Plan</Label>
                        <Badge className="bg-blue-100 text-blue-800">
                          {organizationSettings.plan.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <Label>Billing Cycle</Label>
                        <p className="text-sm">Monthly</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Next Billing Date</Label>
                        <p className="text-sm">January 15, 2025</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="font-medium">Current Month Usage</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Resumes Processed</p>
                          <p className="text-2xl font-bold">24</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">AI Matches</p>
                          <p className="text-2xl font-bold">156</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Interviews</p>
                          <p className="text-2xl font-bold">8</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">API Calls</p>
                          <p className="text-2xl font-bold">1,247</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button>Upgrade Plan</Button>
                      <Button variant="outline">View Billing History</Button>
                    </div>
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
                    <CardDescription>Connect with external services and job boards</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                            <Globe className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h4 className="font-medium">LinkedIn Integration</h4>
                            <p className="text-sm text-muted-foreground">Post jobs and source candidates</p>
                          </div>
                        </div>
                        <Button variant="outline">Configure</Button>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
                            <Globe className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h4 className="font-medium">Indeed Integration</h4>
                            <p className="text-sm text-muted-foreground">Sync job postings with Indeed</p>
                          </div>
                        </div>
                        <Button variant="outline">Configure</Button>
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                            <Mail className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h4 className="font-medium">Email Integration</h4>
                            <p className="text-sm text-muted-foreground">SMTP settings for notifications</p>
                          </div>
                        </div>
                        <Button variant="outline">Configure</Button>
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
                            <Phone className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h4 className="font-medium">Twilio Integration</h4>
                            <p className="text-sm text-muted-foreground">AI calling and SMS capabilities</p>
                          </div>
                        </div>
                        <Badge className="bg-green-100 text-green-800">Connected</Badge>
                      </div>
                    </div>
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