import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Building2,
  UserPlus,
  BarChart3,
  Settings,
} from "lucide-react";

const managementTabs = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/management/dashboard",
  },
  {
    id: "organizations",
    label: "Organizations",
    icon: Building2,
    path: "/management/organizations",
  },
  {
    id: "onboarding",
    label: "Onboarding",
    icon: UserPlus,
    path: "/management/onboarding",
  },
  //{
  //  id: "analytics",
  //  label: "Analytics",
  //  icon: BarChart3,
  //  path: "/management/analytics"
  // },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    path: "/management/settings",
  },
];

export default function ManagementNav() {
  const [location] = useLocation();

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <nav className="flex space-x-8">
          {managementTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              location === tab.path || location.startsWith(`${tab.path}/`);

            return (
              <Link key={tab.id} href={tab.path}>
                <div
                  className={`
                  flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm
                  ${
                    isActive
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
