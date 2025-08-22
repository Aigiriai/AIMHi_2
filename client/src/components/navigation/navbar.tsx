import { useState } from "react";
import { useLocation } from "wouter";
import { authService } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Users, 
  Briefcase, 
  BarChart3, 
  Settings, 
  LogOut, 
  Shield,
  Crown,
  UserCheck
} from "lucide-react";

export default function Navbar() {
  const [, setLocation] = useLocation();
  const user = authService.getUser();

  if (!user) return null;

  const handleLogout = () => {
    authService.logout();
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="w-4 h-4" />;
      case 'org_admin':
        return <Shield className="w-4 h-4" />;
      case 'manager':
      case 'team_lead':
        return <UserCheck className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800';
      case 'org_admin':
        return 'bg-blue-100 text-blue-800';
      case 'manager':
      case 'team_lead':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRole = (role: string) => {
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const navigationItems = [
    // Super Admin gets Management and Recruitment dashboards
    ...(user.role === 'super_admin' ? [
      {
        label: 'Management',
        href: '/management',
        icon: Building2,
        roles: ['super_admin']
      },
      {
        label: 'Recruitment',
        href: '/recruitment',
        icon: Briefcase,
        roles: ['super_admin']
      }
    ] : [
      // Other roles get Recruitment dashboard
      {
        label: 'Recruitment',
        href: '/recruitment',
        icon: Briefcase,
        roles: ['org_admin', 'manager', 'team_lead', 'recruiter']
      },
      {
        label: 'Settings',
        href: '/settings',
        icon: Settings,
        roles: ['org_admin']
      }
    ])
  ];

  const visibleNavItems = navigationItems.filter(item => 
    item.roles.includes(user.role)
  );

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo and Org Name */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">AIM Hi</h1>
              {user.role !== 'super_admin' && (
                <p className="text-xs text-gray-500">{user.organizationName}</p>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation(item.href)}
                  className="flex items-center space-x-2"
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* User Menu */}
        <div className="flex items-center space-x-3">
          {/* Organization Plan Badge - HIDDEN */}
          {/* 
          {user.role !== 'super_admin' && (
            <Badge variant="outline" className="hidden sm:inline-flex">
              {user.organizationPlan?.toUpperCase() || 'TRIAL'}
            </Badge>
          )}
          */}

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 h-auto p-2">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-sm">
                    {getInitials(user.firstName, user.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <div className="flex items-center space-x-1">
                    {getRoleIcon(user.role)}
                    <span className="text-xs text-gray-500">
                      {formatRole(user.role)}
                    </span>
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                  <Badge className={`text-xs ${getRoleBadgeColor(user.role)}`}>
                    {formatRole(user.role)}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Mobile Navigation */}
              <div className="md:hidden">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      onClick={() => setLocation(item.href)}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
              </div>

              <DropdownMenuItem onClick={() => setLocation('/profile')}>
                <Settings className="w-4 h-4 mr-2" />
                Profile Settings
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}