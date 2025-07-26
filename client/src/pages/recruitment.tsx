import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ProtectedRoute from "@/components/auth/protected-route";
import Navbar from "@/components/navigation/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrainIcon, BriefcaseIcon, UsersIcon, PercentIcon, BellIcon, SearchIcon, DownloadIcon, PlusIcon, UploadIcon, ExternalLinkIcon, CalendarIcon, Trash2Icon, LayoutDashboard, Users, Calendar, BarChart3 } from "lucide-react";
import JobPostingModal from "@/components/job-posting-modal";
import ResumeUploadModal from "@/components/resume-upload-modal";
import JobBoardIntegration from "@/components/job-board-integration";
import EnhancedInterviewModal from "@/components/enhanced-interview-modal";
import AdvancedAIMatchingModal from "@/components/advanced-ai-matching-modal";
import InterviewsTable from "@/components/interviews-table";
import ResultsTable from "@/components/results-table";
import JobTemplateViewer from "@/components/job-template-viewer";
import JobAssignmentModal from "@/components/job-assignment-modal";
import { CandidateAssignmentModal } from "@/components/candidate-assignment-modal";
import { PipelineKanban } from "@/components/pipeline-kanban";
import { ApplyToJobDropdown } from "@/components/apply-to-job-dropdown";
import { AddCandidateDropdown } from "@/components/add-candidate-dropdown";

import type { JobMatchResult, Job, Candidate, InterviewWithDetails } from "@shared/schema";

interface Stats {
  activeJobs: number;
  totalCandidates: number;
  aiMatches: number;
  totalInterviews: number;
  avgMatchRate: number;
}

function RecruitmentDashboard() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [showJobModal, setShowJobModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showAdvancedAIModal, setShowAdvancedAIModal] = useState(false);
  const [showJobBoardModal, setShowJobBoardModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJobs, setSelectedJobs] = useState<number[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedJobForAssignment, setSelectedJobForAssignment] = useState<{id: number, title: string} | null>(null);

  // Listen for custom events from pipeline navigation
  useEffect(() => {
    const handleSwitchToJobs = () => {
      console.log(`🔗 RECRUITMENT: Switching to jobs tab from pipeline`);
      setActiveTab('jobs');
    };

    const handleSwitchToCandidates = () => {
      console.log(`🔗 RECRUITMENT: Switching to candidates tab from pipeline`);
      setActiveTab('candidates');
    };

    window.addEventListener('switchToJobsTab', handleSwitchToJobs);
    window.addEventListener('switchToCandidatesTab', handleSwitchToCandidates);

    return () => {
      window.removeEventListener('switchToJobsTab', handleSwitchToJobs);
      window.removeEventListener('switchToCandidatesTab', handleSwitchToCandidates);
    };
  }, []);

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

  const { data: interviews = [], isLoading: interviewsLoading } = useQuery<InterviewWithDetails[]>({
    queryKey: ["/api/interviews"],
  });

  const filteredMatches = matches.filter(match =>
    searchTerm === "" ||
    match.job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    match.candidate.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportResults = () => {
    const csvContent = [
      ['Job Title', 'Candidate Name', 'Match Percentage', 'Experience', 'Email'],
      ...filteredMatches.map(match => [
        match.job.title,
        match.candidate.name,
        `${match.matchPercentage}%`,
        `${match.candidate.experience} years`,
        match.candidate.email
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-matching-results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDeleteJobs = async () => {
    if (selectedJobs.length === 0) return;
    
    setIsDeleting(true);
    try {
      const deletePromises = selectedJobs.map(jobId =>
        fetch(`/api/jobs/${jobId}`, { 
          method: "DELETE",
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          }
        })
      );
      
      await Promise.all(deletePromises);
      
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      
      toast({
        title: "Success",
        description: `${selectedJobs.length} job posting${selectedJobs.length > 1 ? 's' : ''} deleted successfully`,
      });
      
      setSelectedJobs([]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete job postings",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCandidates = async () => {
    if (selectedCandidates.length === 0) return;
    
    setIsDeleting(true);
    try {
      const deletePromises = selectedCandidates.map(candidateId =>
        fetch(`/api/candidates/${candidateId}`, { 
          method: "DELETE",
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          }
        })
      );
      
      await Promise.all(deletePromises);
      
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      
      toast({
        title: "Success",
        description: `${selectedCandidates.length} candidate${selectedCandidates.length > 1 ? 's' : ''} deleted successfully`,
      });
      
      setSelectedCandidates([]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete candidates",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleJobSelection = (jobId: number) => {
    setSelectedJobs(prev =>
      prev.includes(jobId)
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const toggleCandidateSelection = (candidateId: number) => {
    setSelectedCandidates(prev =>
      prev.includes(candidateId)
        ? prev.filter(id => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const toggleAllJobs = () => {
    if (selectedJobs.length === jobs.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(jobs.map(job => job.id));
    }
  };

  const toggleAllCandidates = () => {
    if (selectedCandidates.length === candidates.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(candidates.map(candidate => candidate.id));
    }
  };

  const handleAssignJob = (jobId: number, jobTitle: string) => {
    setSelectedJobForAssignment({ id: jobId, title: jobTitle });
    setShowAssignmentModal(true);
  };

  // Data Management functions
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
        description: "All AI matches have been cleared.",
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

  const tabs = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "jobs", label: "Job Postings", icon: BriefcaseIcon },
    { value: "candidates", label: "Candidates", icon: Users },
    { value: "ai-matching", label: "AI Matching", icon: BrainIcon },
    { value: "pipeline", label: "Pipeline", icon: BarChart3 }
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-2">
              <BriefcaseIcon className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Recruitment</h1>
            </div>
            <p className="text-gray-600">AI-powered recruitment and talent management</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 mb-8">
              {tabs.map(tab => {
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

            {/* Overview Tab - Dashboard Content */}
            <TabsContent value="overview" className="mt-0">
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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

                {/* AI Matches Today, Interviews, and Match Rate cards removed */}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <Button onClick={() => setShowJobModal(true)} className="h-20 flex flex-col items-center justify-center space-y-2">
                  <PlusIcon size={24} />
                  <span>Post New Job</span>
                </Button>
                <Button variant="outline" onClick={() => setShowResumeModal(true)} className="h-20 flex flex-col items-center justify-center space-y-2">
                  <UploadIcon size={24} />
                  <span>Upload Resume</span>
                </Button>
                <Button variant="outline" onClick={() => setShowAdvancedAIModal(true)} className="h-20 flex flex-col items-center justify-center space-y-2">
                  <BrainIcon size={24} />
                  <span>AI Matching</span>
                </Button>
                {/* Schedule Interview button hidden as requested */}
              </div>

              {/* Data Management */}
              <Card className="mb-8">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Management</h3>
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
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Recent AI Matches</h3>
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <Input
                          placeholder="Search matches..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 w-64"
                        />
                      </div>
                      <Button onClick={exportResults} disabled={matches.length === 0}>
                        <DownloadIcon className="mr-2" size={16} />
                        Export
                      </Button>
                    </div>
                  </div>

                  <ResultsTable
                    matches={filteredMatches}
                    isLoading={matchesLoading}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Job Postings Tab */}
            <TabsContent value="jobs" className="mt-0">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Job Postings</h2>
                  <div className="flex items-center gap-3">
                    {selectedJobs.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteJobs}
                        disabled={isDeleting}
                      >
                        <Trash2Icon size={16} className="mr-2" />
                        Delete Selected ({selectedJobs.length})
                      </Button>
                    )}
                    <Button onClick={() => setShowJobModal(true)}>
                      <PlusIcon size={16} className="mr-2" />
                      Post New Job
                    </Button>
                  </div>
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
                  <div className="space-y-4">
                    {jobs.length > 0 && (
                      <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Checkbox
                          checked={selectedJobs.length === jobs.length}
                          onCheckedChange={toggleAllJobs}
                        />
                        <span className="text-sm font-medium">
                          Select All ({jobs.length} jobs)
                        </span>
                      </div>
                    )}
                    <div className="grid gap-4">
                      {jobs.map((job) => (
                        <Card key={job.id} className={selectedJobs.includes(job.id) ? "ring-2 ring-blue-500" : ""}>
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                              <Checkbox
                                checked={selectedJobs.includes(job.id)}
                                onCheckedChange={() => toggleJobSelection(job.id)}
                              />
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold">{job.title}</h3>
                                <p className="text-sm text-gray-500 mb-2">ID: {job.id}</p>
                                <p className="text-gray-600 mt-2">{job.description}</p>
                                <div className="flex items-center justify-between mt-4">
                                  <div className="flex items-center gap-4">
                                    <Badge variant="secondary">{job.experienceLevel}</Badge>
                                    <Badge variant="outline">{job.jobType}</Badge>
                                    <span className="text-sm text-gray-500">
                                      Created {new Date(job.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <AddCandidateDropdown 
                                      jobId={job.id} 
                                      jobTitle={job.title}
                                      onApplicationCreated={() => {
                                        queryClient.invalidateQueries({ queryKey: ['/api/pipeline'] });
                                        queryClient.invalidateQueries({ queryKey: ['/api/pipeline/stats'] });
                                      }}
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleAssignJob(job.id, job.title)}
                                    >
                                      <UsersIcon size={14} className="mr-1" />
                                      Assign
                                    </Button>
                                    <JobTemplateViewer jobId={job.id} jobTitle={job.title} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Candidates Tab */}
            <TabsContent value="candidates" className="mt-0">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Candidates</h2>
                  <div className="flex items-center gap-3">
                    {selectedCandidates.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteCandidates}
                        disabled={isDeleting}
                      >
                        <Trash2Icon size={16} className="mr-2" />
                        Delete Selected ({selectedCandidates.length})
                      </Button>
                    )}
                    <Button onClick={() => setShowResumeModal(true)}>
                      <UploadIcon size={16} className="mr-2" />
                      Upload Resume
                    </Button>
                  </div>
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
                  <div className="space-y-4">
                    {candidates.length > 0 && (
                      <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Checkbox
                          checked={selectedCandidates.length === candidates.length}
                          onCheckedChange={toggleAllCandidates}
                        />
                        <span className="text-sm font-medium">
                          Select All ({candidates.length} candidates)
                        </span>
                      </div>
                    )}
                    <div className="grid gap-4">
                      {candidates.map((candidate) => (
                        <Card key={candidate.id} className={selectedCandidates.includes(candidate.id) ? "ring-2 ring-blue-500" : ""}>
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                              <Checkbox
                                checked={selectedCandidates.includes(candidate.id)}
                                onCheckedChange={() => toggleCandidateSelection(candidate.id)}
                              />
                              <div className="flex-1">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h3 className="text-lg font-semibold">{candidate.name}</h3>
                                    <p className="text-gray-600">{candidate.email}</p>
                                    <p className="text-sm text-gray-500">ID: {candidate.id}</p>
                                    <div className="flex items-center gap-4 mt-4">
                                      <Badge variant="secondary">{candidate.experience} years experience</Badge>
                                      <span className="text-sm text-gray-500">{candidate.phone}</span>
                                    </div>
                                  </div>
                                  <div className="flex space-x-2">
                                    <ApplyToJobDropdown 
                                      candidateId={candidate.id} 
                                      candidateName={candidate.name}
                                      onApplicationCreated={() => {
                                        queryClient.invalidateQueries({ queryKey: ['/api/pipeline'] });
                                        queryClient.invalidateQueries({ queryKey: ['/api/pipeline/stats'] });
                                      }}
                                    />
                                    <Button variant="outline" size="sm">
                                      View Resume
                                    </Button>
                                    <CandidateAssignmentModal 
                                      candidateId={candidate.id}
                                      candidateName={candidate.name}
                                      trigger={
                                        <Button variant="outline" size="sm">
                                          <Users className="h-4 w-4 mr-1" />
                                          Assign
                                        </Button>
                                      }
                                    />
                                    <Button variant="outline" size="sm">
                                      Schedule Interview
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* AI Matching Tab */}
            <TabsContent value="ai-matching" className="mt-0">
              <div className="space-y-6">
                {/* AI Matching Controls */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">AI Matching Results</h3>
                      <div className="flex items-center space-x-2">
                        <div className="relative">
                          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                          <Input
                            placeholder="Search matches..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAdvancedAIModal(true)}
                        >
                          <BrainIcon className="w-4 h-4 mr-2" />
                          Run AI Match
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={exportResults}
                        >
                          <DownloadIcon className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                      </div>
                    </div>
                    
                    {/* AI Matching Results */}
                    <ResultsTable matches={filteredMatches} isLoading={matchesLoading} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Pipeline Tab - Kanban Board */}
            <TabsContent value="pipeline" className="mt-0">
              <PipelineKanban />
            </TabsContent>
          </Tabs>

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

          {selectedJobForAssignment && (
            <JobAssignmentModal
              open={showAssignmentModal}
              onOpenChange={setShowAssignmentModal}
              jobId={selectedJobForAssignment.id}
              jobTitle={selectedJobForAssignment.title}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default RecruitmentDashboard;