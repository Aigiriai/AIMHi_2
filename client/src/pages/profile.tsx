import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProtectedRoute from "@/components/auth/protected-route";
import Navbar from "@/components/navigation/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/lib/auth";
import { 
  User, 
  Mail, 
  Phone, 
  Bell,
  Shield,
  Key,
  Save,
  Edit,
  Camera,
  Eye,
  EyeOff,
  Clock,
  MapPin,
  Monitor,
  Smartphone
} from "lucide-react";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      "Password must contain uppercase, lowercase, number, and special character"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [notifications, setNotifications] = useState({
    email: true,
    browser: true,
    newCandidates: true,
    interviewReminders: true,
    systemUpdates: false,
  });

  // Use React Query to fetch current user data
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: () => authService.getCurrentUser(),
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    },
  });

  // Update form values when user data loads
  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user, form]);

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      console.log('Sending profile update:', data);
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken()}`,
        },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
        }),
      });
      
      console.log('Profile update response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Failed to update profile';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Profile update successful:', result);
      return result;
    },
    onSuccess: () => {
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
      
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken()}`,
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Password change failed');
      }
      
      toast({
        title: "Password Changed",
        description: "Your password has been successfully updated.",
      });
      
      passwordForm.reset();
      setShowPasswordDialog(false);
    } catch (error) {
      toast({
        title: "Password Change Failed",
        description: error instanceof Error ? error.message : "Failed to change password. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
    toast({
      title: "Notification Settings Updated",
      description: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} notifications ${value ? 'enabled' : 'disabled'}.`,
    });
  };

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Mock login history data
  const loginHistory = [
    { id: 1, device: "Chrome on Windows", location: "New York, US", date: "2024-01-15 09:30 AM", current: true },
    { id: 2, device: "Safari on iPhone", location: "New York, US", date: "2024-01-14 06:45 PM", current: false },
    { id: 3, device: "Chrome on Mac", location: "Boston, US", date: "2024-01-12 02:15 PM", current: false },
    { id: 4, device: "Firefox on Windows", location: "New York, US", date: "2024-01-10 11:20 AM", current: false },
  ];

  if (isLoading) {
    return (
      <ProtectedRoute requiredRoles={['super_admin', 'org_admin', 'manager', 'team_lead', 'recruiter']}>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!user) return null;

  return (
    <ProtectedRoute requiredRoles={['super_admin', 'org_admin', 'manager', 'team_lead', 'recruiter']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
            <p className="text-gray-600">Manage your personal account information and preferences</p>
          </div>

          <div className="space-y-6">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <User className="w-5 h-5" />
                      <span>Personal Information</span>
                    </CardTitle>
                    <CardDescription>Update your personal details and contact information</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {isEditing ? "Cancel" : "Edit"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex space-x-2">
                        <Button 
                          type="submit" 
                          disabled={updateProfileMutation.isPending}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsEditing(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <div className="space-y-6">
                    {/* Profile Avatar */}
                    <div className="flex items-center space-x-4">
                      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-blue-600">
                          {user?.firstName?.charAt(0) || ""}{user?.lastName?.charAt(0) || ""}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium">{user?.firstName} {user?.lastName}</h3>
                        <p className="text-gray-500">{user?.role?.replace('_', ' ').toUpperCase()}</p>
                        {user?.role !== 'super_admin' && (
                          <p className="text-sm text-gray-400">{user?.organizationName}</p>
                        )}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Contact Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="flex items-center space-x-2">
                          <Mail className="w-4 h-4" />
                          <span>Email Address</span>
                        </Label>
                        <p className="text-sm text-gray-900">{user?.email}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center space-x-2">
                          <Phone className="w-4 h-4" />
                          <span>Phone Number</span>
                        </Label>
                        <p className="text-sm text-gray-900">{user?.phone || "Not provided"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notification Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bell className="w-5 h-5" />
                  <span>Notification Preferences</span>
                </CardTitle>
                <CardDescription>Choose how you want to be notified about important events</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <Switch 
                      checked={notifications.email}
                      onCheckedChange={(value) => handleNotificationChange('email', value)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Browser Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive push notifications in browser</p>
                    </div>
                    <Switch 
                      checked={notifications.browser}
                      onCheckedChange={(value) => handleNotificationChange('browser', value)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>New Candidates</Label>
                      <p className="text-sm text-muted-foreground">Notify when new candidates are added</p>
                    </div>
                    <Switch 
                      checked={notifications.newCandidates}
                      onCheckedChange={(value) => handleNotificationChange('newCandidates', value)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Interview Reminders</Label>
                      <p className="text-sm text-muted-foreground">Reminders for upcoming interviews</p>
                    </div>
                    <Switch 
                      checked={notifications.interviewReminders}
                      onCheckedChange={(value) => handleNotificationChange('interviewReminders', value)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>System Updates</Label>
                      <p className="text-sm text-muted-foreground">Important platform updates and maintenance</p>
                    </div>
                    <Switch 
                      checked={notifications.systemUpdates}
                      onCheckedChange={(value) => handleNotificationChange('systemUpdates', value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Security & Privacy</span>
                </CardTitle>
                <CardDescription>Manage your account security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Change Password</Label>
                      <p className="text-sm text-muted-foreground">Update your account password</p>
                    </div>
                    <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Key className="w-4 h-4 mr-2" />
                          Change Password
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center space-x-2">
                            <Key className="w-5 h-5" />
                            <span>Change Password</span>
                          </DialogTitle>
                          <DialogDescription>
                            Enter your current password and choose a new secure password.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <Form {...passwordForm}>
                          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                            <FormField
                              control={passwordForm.control}
                              name="currentPassword"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Current Password</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input
                                        type={showPasswords.current ? "text" : "password"}
                                        placeholder="Enter current password"
                                        {...field}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() => togglePasswordVisibility('current')}
                                      >
                                        {showPasswords.current ? (
                                          <EyeOff className="h-4 w-4" />
                                        ) : (
                                          <Eye className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={passwordForm.control}
                              name="newPassword"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>New Password</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input
                                        type={showPasswords.new ? "text" : "password"}
                                        placeholder="Enter new password"
                                        {...field}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() => togglePasswordVisibility('new')}
                                      >
                                        {showPasswords.new ? (
                                          <EyeOff className="h-4 w-4" />
                                        ) : (
                                          <Eye className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={passwordForm.control}
                              name="confirmPassword"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Confirm New Password</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input
                                        type={showPasswords.confirm ? "text" : "password"}
                                        placeholder="Confirm new password"
                                        {...field}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() => togglePasswordVisibility('confirm')}
                                      >
                                        {showPasswords.confirm ? (
                                          <EyeOff className="h-4 w-4" />
                                        ) : (
                                          <Eye className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <div className="flex space-x-2 pt-4">
                              <Button type="submit" className="flex-1">
                                Update Password
                              </Button>
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setShowPasswordDialog(false)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </Form>
                        
                        <div className="text-xs text-muted-foreground mt-4">
                          <p className="font-medium mb-1">Password requirements:</p>
                          <ul className="list-disc list-inside space-y-1">
                            <li>At least 8 characters long</li>
                            <li>Contains uppercase and lowercase letters</li>
                            <li>Contains at least one number</li>
                            <li>Contains at least one special character</li>
                          </ul>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Two-Factor Authentication</Label>
                      <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                    </div>
                    <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          Configure 2FA
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center space-x-2">
                            <Shield className="w-5 h-5" />
                            <span>Two-Factor Authentication</span>
                          </DialogTitle>
                          <DialogDescription>
                            Secure your account with two-factor authentication using an authenticator app.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-6">
                          <div className="text-center">
                            <div className="w-32 h-32 bg-gray-100 mx-auto mb-4 flex items-center justify-center rounded-lg">
                              <p className="text-xs text-gray-500">QR Code</p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Scan this QR code with your authenticator app
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Manual Setup Key</Label>
                            <div className="bg-muted p-3 rounded text-sm font-mono break-all">
                              JBSWY3DPEHPK3PXP
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Verification Code</Label>
                            <Input placeholder="Enter 6-digit code from your app" maxLength={6} />
                          </div>
                          
                          <div className="flex space-x-2">
                            <Button className="flex-1">
                              Enable 2FA
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => setShow2FADialog(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Login History</Label>
                      <p className="text-sm text-muted-foreground">View your recent login activity</p>
                    </div>
                    <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          View History
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center space-x-2">
                            <Clock className="w-5 h-5" />
                            <span>Login History</span>
                          </DialogTitle>
                          <DialogDescription>
                            Your recent login activity and sessions
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {loginHistory.map((login) => (
                            <div key={login.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  {login.device.includes('iPhone') ? (
                                    <Smartphone className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <Monitor className="w-4 h-4 text-blue-600" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{login.device}</p>
                                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                    <MapPin className="w-3 h-3" />
                                    <span>{login.location}</span>
                                    <span>•</span>
                                    <span>{login.date}</span>
                                  </div>
                                </div>
                              </div>
                              {login.current && (
                                <Badge variant="secondary">Current Session</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex justify-end">
                          <Button 
                            variant="outline" 
                            onClick={() => setShowHistoryDialog(false)}
                          >
                            Close
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}