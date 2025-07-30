import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrainIcon, BriefcaseIcon, UsersIcon, PercentIcon, BellIcon, SearchIcon, DownloadIcon, PlusIcon, UploadIcon, ExternalLinkIcon, CalendarIcon, Trash2Icon } from "lucide-react";
import JobPostingModal from "@/components/job-posting-modal";
import ResumeUploadModal from "@/components/resume-upload-modal";
import JobBoardIntegration from "@/components/job-board-integration";
import EnhancedInterviewModal from "@/components/enhanced-interview-modal";
import AdvancedAIMatchingModal from "@/components/advanced-ai-matching-modal";
import InterviewsTable from "@/components/interviews-table";
import ResultsTable from "@/components/results-table";
import type { JobMatchResult, Job, Candidate, InterviewWithDetails } from "@shared/schema";

interface Stats {
  activeJobs: number;
  totalCandidates: number;
  aiMatches: number;
  totalInterviews: number;
  avgMatchRate: number;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [showJobModal, setShowJobModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);

  const [showAdvancedAIModal, setShowAdvancedAIModal] = useState(false);
  const [showJobBoardModal, setShowJobBoardModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: matches = [], isLoading: matchesLoading, refetch: refetchMatches } = useQuery<JobMatchResult[]>({
    queryKey: ["/api/matches"],
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
  });

  const { data: interviews = [], isLoading: interviewsLoading } = useQuery({
    queryKey: ["/api/interviews"],
  });

  const filteredMatches = matches.filter(match => 
    match.candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    match.job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    match.candidate.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Management functions using proper API endpoints
  const handleClearMatches = async () => {
    try {
      const response = await fetch("/api/matches", {
        method: "DELETE"
      });
      
      if (!response.ok) throw new Error("Failed to clear matches");
      
      await queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Your AI matches have been cleared.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear AI matches.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAllJobs = async () => {
    try {
      const response = await fetch("/api/jobs", {
        method: "DELETE"
      });
      
      if (!response.ok) throw new Error("Failed to delete jobs");
      
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "All job postings have been deleted.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete job postings.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAllCandidates = async () => {
    try {
      const response = await fetch("/api/candidates", {
        method: "DELETE"
      });
      
      if (!response.ok) throw new Error("Failed to delete candidates");
      
      await queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "All candidates and resumes have been deleted.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete candidates.",
        variant: "destructive",
      });
    }
  };

  const exportResults = () => {
    if (matches.length === 0) return;
    
    const csvHeader = "Job ID,Job Summary,Candidate Name,Email,Phone,Experience,Match %\n";
    const csvData = matches.map(match => 
      `${match.job.id},"${match.job.title}",${match.candidate.name},${match.candidate.email},${match.candidate.phone},${match.candidate.experience} years,${Math.round(match.matchPercentage)}%`
    ).join("\n");
    
    const blob = new Blob([csvHeader + csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-matching-results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <BrainIcon className="text-white text-xl" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AIM Hi System</h1>
                <p className="text-sm text-gray-500">AI Managed Hiring Intelligence</p>
              </div>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:block">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="jobs">Job Postings</TabsTrigger>
                <TabsTrigger value="candidates">Candidates</TabsTrigger>
                <TabsTrigger value="interviews">Interviews</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon">
                <BellIcon size={20} />
              </Button>
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="dashboard">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
              <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <BriefcaseIcon className="text-primary text-xl" size={24} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">{stats?.activeJobs || 0}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-secondary/10 rounded-lg">
                  <UsersIcon className="text-secondary text-xl" size={24} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Candidates</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">{stats?.totalCandidates || 0}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-accent/10 rounded-lg">
                  <BrainIcon className="text-accent text-xl" size={24} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">AI Matches Today</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">{stats?.aiMatches || 0}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <CalendarIcon className="text-blue-600 text-xl" size={24} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Interviews</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">{stats?.totalInterviews || 0}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <PercentIcon className="text-green-600 text-xl" size={24} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Match Rate</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">{stats?.avgMatchRate || 0}%</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Button
                variant="outline"
                className="flex items-center justify-center p-4 h-auto border-2 border-dashed hover:border-primary hover:bg-primary/5"
                onClick={() => setShowJobModal(true)}
              >
                <PlusIcon className="text-gray-400 text-xl mr-3" size={24} />
                <span className="text-gray-600 font-medium">Post New Job</span>
              </Button>

              <Button
                variant="outline"
                className="flex items-center justify-center p-4 h-auto border-2 border-dashed hover:border-secondary hover:bg-secondary/5"
                onClick={() => setShowResumeModal(true)}
              >
                <UploadIcon className="text-gray-400 text-xl mr-3" size={24} />
                <span className="text-gray-600 font-medium">Upload Resumes</span>
              </Button>

              <Button
                variant="outline"
                className="flex items-center justify-center p-4 h-auto border-2 border-dashed hover:border-purple-500 hover:bg-purple-50"
                onClick={() => setShowAdvancedAIModal(true)}
              >
                <BrainIcon className="text-gray-400 text-xl mr-3" size={24} />
                <span className="text-gray-600 font-medium">Advanced AI Matching</span>
              </Button>



              <Button
                variant="outline"
                className="flex items-center justify-center p-4 h-auto border-2 border-dashed hover:border-blue-500 hover:bg-blue-50"
                onClick={() => {
                  console.log("Schedule Interview clicked!");
                  setShowInterviewModal(true);
                }}
              >
                <CalendarIcon className="text-gray-400 text-xl mr-3" size={24} />
                <span className="text-gray-600 font-medium">Schedule Interview</span>
              </Button>

              <Button
                variant="outline"
                className="flex items-center justify-center p-4 h-auto border-2 border-dashed hover:border-blue-500 hover:bg-blue-50"
                onClick={() => setShowJobBoardModal(true)}
              >
                <ExternalLinkIcon className="text-gray-400 text-xl mr-3" size={24} />
                <span className="text-gray-600 font-medium">LinkedIn & Indeed</span>
              </Button>
            </div>
            
            {/* Management Actions */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Data Management</h3>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="hover:border-red-500 hover:bg-red-50 hover:text-red-700"
                  onClick={() => handleClearMatches()}
                >
                  <Trash2Icon className="mr-2 h-4 w-4" />
                  Clear AI Matches
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="hover:border-red-500 hover:bg-red-50 hover:text-red-700"
                  onClick={() => handleDeleteAllJobs()}
                >
                  <Trash2Icon className="mr-2 h-4 w-4" />
                  Delete All Jobs
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="hover:border-red-500 hover:bg-red-50 hover:text-red-700"
                  onClick={() => handleDeleteAllCandidates()}
                >
                  <Trash2Icon className="mr-2 h-4 w-4" />
                  Delete All Candidates
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card>
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Latest AI Matching Results</h2>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Search matches..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 w-64"
                    />
                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  </div>
                  <Button onClick={exportResults} disabled={matches.length === 0}>
                    <DownloadIcon className="mr-2" size={16} />
                    Export
                  </Button>
                </div>
              </div>
            </div>

            <ResultsTable
              matches={filteredMatches}
              isLoading={matchesLoading}
            />
          </CardContent>
        </Card>

        {/* Modals */}
        <JobPostingModal
          open={showJobModal}
          onOpenChange={setShowJobModal}
          onSuccess={() => refetchMatches()}
        />

        <ResumeUploadModal
          open={showResumeModal}
          onOpenChange={setShowResumeModal}
          onSuccess={() => refetchMatches()}
        />

          </TabsContent>

          <TabsContent value="jobs">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Job Postings</h2>
                <Button onClick={() => setShowJobModal(true)}>
                  <PlusIcon size={16} className="mr-2" />
                  Post New Job
                </Button>
              </div>
              {jobsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : jobs.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <BriefcaseIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No job postings yet</h3>
                    <p className="text-gray-500 mb-4">Start by posting your first job opening.</p>
                    <Button onClick={() => setShowJobModal(true)}>Post Your First Job</Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {jobs.map((job) => (
                    <Card key={job.id}>
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-semibold">{job.title}</h3>
                            <p className="text-gray-600 mt-2">{job.description}</p>
                            <div className="flex items-center gap-4 mt-4">
                              <Badge variant="secondary">{job.experienceLevel}</Badge>
                              <Badge variant="outline">{job.jobType}</Badge>
                              <span className="text-sm text-gray-500">
                                Created {new Date(job.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="candidates">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Candidates</h2>
                <Button onClick={() => setShowResumeModal(true)}>
                  <UploadIcon size={16} className="mr-2" />
                  Upload Resume
                </Button>
              </div>
              {candidatesLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : candidates.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <UsersIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No candidates yet</h3>
                    <p className="text-gray-500 mb-4">Upload resumes to start building your candidate pool.</p>
                    <Button onClick={() => setShowResumeModal(true)}>Upload First Resume</Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {candidates.map((candidate) => (
                    <Card key={candidate.id}>
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-semibold">{candidate.name}</h3>
                            <p className="text-gray-600">{candidate.email}</p>
                            <p className="text-gray-600">{candidate.phone}</p>
                            <div className="flex items-center gap-4 mt-4">
                              <Badge variant="secondary">{candidate.experience} years experience</Badge>
                              <span className="text-sm text-gray-500">
                                Added {new Date(candidate.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            <DownloadIcon size={16} className="mr-2" />
                            Download Resume
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="interviews">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Interview Management</h2>
                <Button onClick={() => setShowInterviewModal(true)}>
                  <CalendarIcon size={16} className="mr-2" />
                  Schedule Interview
                </Button>
              </div>
              
              <InterviewsTable 
                interviews={interviews || []} 
                isLoading={interviewsLoading}
                onScheduleNew={() => setShowInterviewModal(true)}
              />
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Analytics & Insights</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Matching Performance</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Total Matches</span>
                        <span className="font-semibold">{matches.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Average Match Score</span>
                        <span className="font-semibold">
                          {matches.length > 0 
                            ? Math.round(matches.reduce((sum, m) => sum + m.matchPercentage, 0) / matches.length)
                            : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>High Matches (80%+)</span>
                        <span className="font-semibold">
                          {matches.filter(m => m.matchPercentage >= 80).length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">System Overview</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Active Jobs</span>
                        <span className="font-semibold">{stats?.activeJobs || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Candidates</span>
                        <span className="font-semibold">{stats?.totalCandidates || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>AI Matches Generated</span>
                        <span className="font-semibold">{stats?.aiMatches || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {matches.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Recent Matches</h3>
                    <ResultsTable matches={matches.slice(0, 5)} isLoading={matchesLoading} />
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <JobPostingModal
          open={showJobModal}
          onOpenChange={setShowJobModal}
          onSuccess={() => {}}
        />

        <ResumeUploadModal
          open={showResumeModal}
          onOpenChange={setShowResumeModal}
          onSuccess={() => {}}
        />

        <AdvancedAIMatchingModal
          open={showAdvancedAIModal}
          onOpenChange={setShowAdvancedAIModal}
          onSuccess={() => refetchMatches()}
        />

        <EnhancedInterviewModal
          open={showInterviewModal}
          onOpenChange={setShowInterviewModal}
          onSuccess={() => {}}
        />

        <JobBoardIntegration
          open={showJobBoardModal}
          onOpenChange={setShowJobBoardModal}
        />
      </main>
    </div>
  );
}
