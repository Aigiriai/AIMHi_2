import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ProtectedRoute from "@/components/auth/protected-route";
import Navbar from "@/components/navigation/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  Briefcase, 
  UserCheck, 
  Calendar,
  TrendingUp,
  DollarSign,
  Activity,
  Phone
} from "lucide-react";
import { authService } from "@/lib/auth";
import ResultsTable from "@/components/results-table";
import type { JobMatchResult } from "@shared/schema";

// Function to calculate match labels based on relative performance
const calculateMatchLabel = (matchPercentage: number, allMatches: JobMatchResult[]): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string } => {
  if (allMatches.length === 0) return { label: 'No Data', variant: 'outline', color: 'text-gray-500' };
  
  const percentages = allMatches.map(m => m.matchPercentage);
  const maxScore = Math.max(...percentages);
  const minScore = Math.min(...percentages);
  const range = maxScore - minScore;
  
  // If all scores are very close (within 5%), treat them all as "Best"
  if (range <= 5) {
    return { label: 'Best', variant: 'default', color: 'text-green-700' };
  }
  
  // Calculate thresholds based on the top performer
  const bestThreshold = maxScore - 5; // Within 5% of top score
  const aboveAverageThreshold = maxScore - (range * 0.3); // Top 30% range
  const averageThreshold = maxScore - (range * 0.6); // Middle 30% range
  const belowAverageThreshold = maxScore - (range * 0.85); // Next 25% range
  
  if (matchPercentage >= bestThreshold) {
    return { label: 'BEST', variant: 'outline', color: 'bg-white text-black border-gray-300 font-bold' };
  } else if (matchPercentage >= aboveAverageThreshold) {
    return { label: 'ABOVE AVERAGE', variant: 'outline', color: 'bg-white text-black border-gray-300 font-bold' };
  } else if (matchPercentage >= averageThreshold) {
    return { label: 'AVERAGE', variant: 'outline', color: 'bg-white text-black border-gray-300 font-bold' };
  } else if (matchPercentage >= belowAverageThreshold) {
    return { label: 'BELOW AVERAGE', variant: 'outline', color: 'bg-white text-black border-gray-300 font-bold' };
  } else {
    return { label: 'POOR', variant: 'outline', color: 'bg-white text-black border-gray-300 font-bold' };
  }
};

export default function OrganizationDashboard() {
  const user = authService.getUser();
  
  // Fetch organization data
  const { data: stats, isLoading: statsLoading } = useQuery({
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

  const { data: matches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['/api/matches'],
    queryFn: async () => {
      const response = await fetch('/api/matches', {
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch matches');
      return response.json();
    },
  });

  const { data: interviews = [], isLoading: interviewsLoading } = useQuery({
    queryKey: ['/api/interviews'],
    queryFn: async () => {
      const response = await fetch('/api/interviews', {
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch interviews');
      return response.json();
    },
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: async () => {
      const response = await fetch('/api/jobs', {
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch jobs');
      return response.json();
    },
  });

  const recentMatches = matches.slice(0, 5);
  const upcomingInterviews = interviews.filter((interview: any) => 
    interview.status === 'scheduled' && new Date(interview.scheduledDateTime) > new Date()
  ).slice(0, 5);

  const getRoleBasedGreeting = (role: string) => {
    switch (role) {
      case 'org_admin':
        return 'Organization Administration';
      case 'manager':
        return 'Team Management';
      case 'team_lead':
        return 'Team Leadership';
      case 'recruiter':
        return 'Recruitment Dashboard';
      default:
        return 'Dashboard';
    }
  };

  const getRoleBasedDescription = (role: string) => {
    switch (role) {
      case 'org_admin':
        return 'Manage your organization\'s recruitment activities and team performance';
      case 'manager':
        return 'Oversee your team\'s hiring progress and candidate pipeline';
      case 'team_lead':
        return 'Lead your team\'s recruitment efforts and track progress';
      case 'recruiter':
        return 'Manage your assigned job postings and candidate interactions';
      default:
        return 'Your recruitment command center';
    }
  };

  return (
    <ProtectedRoute requiredRoles={['org_admin', 'manager', 'team_lead', 'recruiter']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {getRoleBasedGreeting(user?.role || '')}
                </h1>
                <p className="text-gray-600">
                  {getRoleBasedDescription(user?.role || '')}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="flex items-center space-x-1">
                  <Activity className="w-3 h-3" />
                  <span>{user?.organizationPlan?.toUpperCase() || 'TRIAL'}</span>
                </Badge>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.activeJobs || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {jobsLoading ? 'Loading...' : `${jobs.length} total posted`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalCandidates || 0}</div>
                <p className="text-xs text-muted-foreground">
                  In your pipeline
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI Matches</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.aiMatches || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.avgMatchRate || 0}% avg match rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Interviews</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{interviews.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {upcomingInterviews.length} upcoming
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="matches">AI Matches</TabsTrigger>
              <TabsTrigger value="interviews">Interviews</TabsTrigger>
              {(user?.role === 'org_admin' || user?.role === 'manager') && (
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <UserCheck className="w-5 h-5" />
                      <span>Recent AI Matches</span>
                    </CardTitle>
                    <CardDescription>Latest candidate matching results</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {matchesLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-gray-200 rounded-full" />
                            <div className="flex-1 space-y-1">
                              <div className="h-4 bg-gray-200 rounded w-3/4" />
                              <div className="h-3 bg-gray-200 rounded w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : recentMatches.length > 0 ? (
                      <div className="space-y-4">
                        {recentMatches.map((match: any) => (
                          <div key={match.id} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-blue-600">
                                  {match.candidate.name.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium">{match.candidate.name}</p>
                                <p className="text-xs text-gray-500">{match.job.title}</p>
                              </div>
                            </div>
                            {(() => {
                              const matchLabel = calculateMatchLabel(match.matchPercentage, matches);
                              return (
                                <Badge 
                                  variant="outline" 
                                  className="bg-white text-black border-gray-400 font-bold hover:bg-white"
                                  style={{ backgroundColor: 'white', color: 'black', borderColor: '#9ca3af' }}
                                >
                                  {matchLabel.label}
                                </Badge>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No matches yet. Run AI matching to see results.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5" />
                      <span>Upcoming Interviews</span>
                    </CardTitle>
                    <CardDescription>Scheduled candidate interviews</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {interviewsLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-gray-200 rounded-full" />
                            <div className="flex-1 space-y-1">
                              <div className="h-4 bg-gray-200 rounded w-3/4" />
                              <div className="h-3 bg-gray-200 rounded w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : upcomingInterviews.length > 0 ? (
                      <div className="space-y-4">
                        {upcomingInterviews.map((interview: any) => (
                          <div key={interview.id} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <Calendar className="w-4 h-4 text-green-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{interview.candidate.name}</p>
                                <p className="text-xs text-gray-500">
                                  {new Date(interview.scheduledDateTime).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="flex items-center space-x-1">
                                <Phone className="w-3 h-3" />
                                <span>{interview.interviewType}</span>
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No upcoming interviews scheduled.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="matches">
              <Card>
                <CardHeader>
                  <CardTitle>AI Matching Results</CardTitle>
                  <CardDescription>
                    View and manage candidate matches for your job postings
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ResultsTable matches={matches} isLoading={matchesLoading} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="interviews">
              <Card>
                <CardHeader>
                  <CardTitle>Interview Management</CardTitle>
                  <CardDescription>
                    Schedule and track candidate interviews
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {interviewsLoading ? (
                    <div className="text-center py-8">Loading interviews...</div>
                  ) : interviews.length > 0 ? (
                    <div className="space-y-4">
                      {interviews.map((interview: any) => (
                        <div key={interview.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{interview.candidate.name}</h4>
                              <p className="text-sm text-gray-500">{interview.job.title}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(interview.scheduledDateTime).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant={interview.status === 'completed' ? 'default' : 'outline'}>
                              {interview.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No interviews scheduled yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {(user?.role === 'org_admin' || user?.role === 'manager') && (
              <TabsContent value="analytics">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Recruitment Performance</CardTitle>
                      <CardDescription>Key metrics for your team</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Job Fill Rate</span>
                          <span>78%</span>
                        </div>
                        <Progress value={78} className="h-2" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Time to Fill</span>
                          <span>14 days avg</span>
                        </div>
                        <Progress value={85} className="h-2" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Interview Show Rate</span>
                          <span>92%</span>
                        </div>
                        <Progress value={92} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Usage Summary</CardTitle>
                      <CardDescription>Current month activity</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Resumes Processed</span>
                        <span className="font-medium">24</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">AI Matches Generated</span>
                        <span className="font-medium">156</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Interviews Scheduled</span>
                        <span className="font-medium">8</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Calls Made</span>
                        <span className="font-medium">12</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  );
}