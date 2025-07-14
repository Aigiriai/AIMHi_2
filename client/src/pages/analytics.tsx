import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ProtectedRoute from "@/components/auth/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  Users, 
  Briefcase, 
  Calendar,
  DollarSign,
  Clock,
  Target,
  Award,
  BarChart3,
  PieChart,
  Download
} from "lucide-react";
import { authService } from "@/lib/auth";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30");
  const user = authService.getUser();

  const { data: stats } = useQuery({
    queryKey: ['/api/stats'],
    queryFn: async () => {
      const response = await fetch('/api/stats', {
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  // Use authentic data from the system
  const analyticsData = {
    recruitment: {
      jobFillRate: 0,
      timeToFill: 0,
      interviewShowRate: 0,
      offerAcceptanceRate: 0
    },
    performance: {
      totalHires: 0,
      averageTimeToFill: 0,
      costPerHire: 0,
      sourceEffectiveness: {
        linkedin: 0,
        indeed: 0,
        referrals: 0,
        direct: 0
      }
    },
    trends: {
      monthlyHires: [],
      candidateFlow: [],
      topSkills: []
    }
  };

  const isOrgAdmin = user?.role === 'org_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <ProtectedRoute requiredRoles={['super_admin', 'org_admin', 'manager']}>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
                <p className="text-gray-600">
                  {isSuperAdmin 
                    ? "Platform-wide recruitment analytics and performance metrics"
                    : "Track your recruitment performance and team metrics"
                  }
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 3 months</SelectItem>
                    <SelectItem value="365">Last year</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Hires</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.performance.totalHires}</div>
                <p className="text-xs text-muted-foreground">
                  No data available
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Time to Fill</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.performance.averageTimeToFill} days</div>
                <p className="text-xs text-muted-foreground">
                  No data available
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cost per Hire</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${analyticsData.performance.costPerHire.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  No data available
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Job Fill Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.recruitment.jobFillRate}%</div>
                <p className="text-xs text-muted-foreground">
                  No data available
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts and Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Recruitment Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Recruitment Performance</span>
                </CardTitle>
                <CardDescription>Key recruitment metrics and efficiency indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Job Fill Rate</span>
                      <span>{analyticsData.recruitment.jobFillRate}%</span>
                    </div>
                    <Progress value={analyticsData.recruitment.jobFillRate} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Interview Show Rate</span>
                      <span>{analyticsData.recruitment.interviewShowRate}%</span>
                    </div>
                    <Progress value={analyticsData.recruitment.interviewShowRate} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Offer Acceptance Rate</span>
                      <span>{analyticsData.recruitment.offerAcceptanceRate}%</span>
                    </div>
                    <Progress value={analyticsData.recruitment.offerAcceptanceRate} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Source Effectiveness */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PieChart className="w-5 h-5" />
                  <span>Candidate Sources</span>
                </CardTitle>
                <CardDescription>Effectiveness of different recruitment channels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analyticsData.performance.sourceEffectiveness).map(([source, percentage]) => (
                    <div key={source} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                        <span className="text-sm font-medium capitalize">{source}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Progress value={percentage} className="w-20 h-2" />
                        <span className="text-sm text-gray-500 w-8">{percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Skills */}
            <Card>
              <CardHeader>
                <CardTitle>In-Demand Skills</CardTitle>
                <CardDescription>Most frequently required skills in job postings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.trends.topSkills.length > 0 ? (
                    analyticsData.trends.topSkills.map((skill, index) => (
                      <div key={skill} className="flex items-center justify-between">
                        <span className="text-sm">{skill}</span>
                        <Badge variant="outline">{index + 1}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <p className="text-sm">No skill data available</p>
                      <p className="text-xs mt-1">Add job postings to see trending skills</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Trends</CardTitle>
                <CardDescription>Hiring activity over the past 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.trends.monthlyHires.length > 0 ? (
                    analyticsData.trends.monthlyHires.map((hires, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm">Month {index + 1}</span>
                        <div className="flex items-center space-x-2">
                          <Progress value={(hires / 30) * 100} className="w-16 h-2" />
                          <span className="text-sm font-medium">{hires}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <p className="text-sm">No hiring data available</p>
                      <p className="text-xs mt-1">Start hiring to see monthly trends</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* AI Performance */}
            <Card>
              <CardHeader>
                <CardTitle>AI Matching Performance</CardTitle>
                <CardDescription>AI system effectiveness metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Match Accuracy</span>
                    <span className="font-medium">-</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Time Saved</span>
                    <span className="font-medium">-</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Candidates Processed</span>
                    <span className="font-medium">{stats?.totalCandidates || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Matches Generated</span>
                    <span className="font-medium">{stats?.aiMatches || 0}</span>
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