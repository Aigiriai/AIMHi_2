import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  Plus, 
  ArrowRight, 
  Calendar, 
  MapPin, 
  Clock,
  BarChart3,
  TrendingUp,
  UserCheck,
  Building,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Application {
  id: number;
  jobId: number;
  candidateId: number;
  status: string;
  currentStage: string;
  appliedAt: string;
  matchPercentage?: number;
  notes: string;
  candidateName: string;
  candidateEmail: string;
  candidateExperience: number;
  lastStageChangeAt: string;
}

interface Job {
  id: number;
  title: string;
  status: string;
  createdAt: string;
  createdBy: number;
  organizationId: number;
  approvedBy?: number;
  approvedAt?: string;
  requiresApproval: boolean;
  createdByName: string;
  applications: Application[];
}

interface PipelineStats {
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  jobsByStatus: { [key: string]: number };
  applicationsByStatus: { [key: string]: number };
}

const jobStages = [
  { id: 'draft', name: 'Draft', color: 'bg-gray-100 text-gray-800' },
  { id: 'active', name: 'Active', color: 'bg-green-100 text-green-800' },
  { id: 'paused', name: 'Paused', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'filled', name: 'Filled', color: 'bg-blue-100 text-blue-800' },
  { id: 'closed', name: 'Closed', color: 'bg-red-100 text-red-800' },
  { id: 'archived', name: 'Archived', color: 'bg-gray-200 text-gray-600' }
];

const applicationStages = [
  { id: 'new', name: 'New', color: 'bg-blue-100 text-blue-800' },
  { id: 'screening', name: 'Screening', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'qualified', name: 'Qualified', color: 'bg-green-100 text-green-800' },
  { id: 'interviewing', name: 'Interviewing', color: 'bg-purple-100 text-purple-800' },
  { id: 'reference_check', name: 'Reference Check', color: 'bg-orange-100 text-orange-800' },
  { id: 'offer', name: 'Offer', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'hired', name: 'Hired', color: 'bg-green-200 text-green-900' },
  { id: 'rejected', name: 'Rejected', color: 'bg-red-100 text-red-800' },
  { id: 'withdrawn', name: 'Withdrawn', color: 'bg-gray-100 text-gray-600' }
];

export function PipelineKanban() {
  const [selectedView, setSelectedView] = useState<'jobs' | 'applications'>('jobs');
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Force refresh on component mount to get latest data
  React.useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/pipeline'] });
  }, [queryClient]);

  // Fetch pipeline data
  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ['/api/pipeline'],
    refetchInterval: 5000, // Refresh every 5 seconds to see debug logs
    staleTime: 0, // Always fetch fresh data
  });

  const { data: statsData } = useQuery({
    queryKey: ['/api/pipeline/stats'],
    refetchInterval: 3000, // Refresh every 3 seconds for real-time updates
    staleTime: 0, // Always treat data as stale to force fresh fetches
    gcTime: 0, // TanStack Query v5 property (replaces cacheTime)
  });

  // Move application mutation
  const moveApplicationMutation = useMutation({
    mutationFn: async ({ applicationId, newStage, reason }: { applicationId: number; newStage: string; reason?: string }) => {
      console.log(`🔄 FRONTEND: Starting application move - ID: ${applicationId}, Stage: ${newStage}, Reason: ${reason}`);
      try {
        const response = await apiRequest("POST", `/api/applications/${applicationId}/move`, { newStage, reason });
        const result = await response.json();
        console.log(`✅ FRONTEND: Application move successful:`, result);
        return result;
      } catch (error) {
        console.error(`❌ FRONTEND: Application move failed:`, error);
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      console.log(`✅ FRONTEND: Move mutation success for application ${variables.applicationId}`);
      // Force fresh data fetch by invalidating all pipeline queries
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline/stats'] });
      queryClient.refetchQueries({ queryKey: ['/api/pipeline/stats'] });
      toast({ title: "Application moved successfully" });
    },
    onError: (error, variables) => {
      console.error(`❌ FRONTEND: Move mutation error for application ${variables.applicationId}:`, error);
      toast({ title: "Failed to move application", variant: "destructive" });
    }
  });

  // Update job status mutation
  const updateJobStatusMutation = useMutation({
    mutationFn: async ({ jobId, newStatus, reason }: { jobId: number; newStatus: string; reason?: string }) => {
      console.log(`🔄 FRONTEND: Starting job status update - ID: ${jobId}, Status: ${newStatus}, Reason: ${reason}`);
      try {
        const response = await apiRequest("POST", `/api/jobs/${jobId}/status`, { newStatus, reason });
        const result = await response.json();
        console.log(`✅ FRONTEND: Job status update successful:`, result);
        return result;
      } catch (error) {
        console.error(`❌ FRONTEND: Job status update failed:`, error);
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      console.log(`✅ FRONTEND: Job status mutation success for job ${variables.jobId}`);
      // Force fresh data fetch by invalidating all pipeline queries
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline/stats'] });
      queryClient.refetchQueries({ queryKey: ['/api/pipeline/stats'] });
      toast({ title: "Job status updated successfully" });
    },
    onError: (error, variables) => {
      console.error(`❌ FRONTEND: Job status mutation error for job ${variables.jobId}:`, error);
      toast({ title: "Failed to update job status", variant: "destructive" });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const jobs: Job[] = (pipelineData as any)?.jobs || [];
  // Fix stats data extraction - backend returns {success: true, stats: {...}}
  const stats: PipelineStats = (statsData as any)?.stats || {
    totalJobs: 0,
    activeJobs: 0,
    totalApplications: 0,
    jobsByStatus: {},
    applicationsByStatus: {}
  };
  
  // Debug logging removed for cleaner UI

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                <p className="text-2xl font-bold">{stats.totalJobs}</p>
              </div>
              <Building className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                <p className="text-2xl font-bold">{stats.activeJobs}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Applications</p>
                <p className="text-2xl font-bold">{stats.totalApplications}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Hired This Month</p>
                <p className="text-2xl font-bold">{stats.applicationsByStatus?.hired || 0}</p>
              </div>
              <UserCheck className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle */}
      <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as 'jobs' | 'applications')}>
        <TabsList>
          <TabsTrigger value="jobs">Job Pipeline</TabsTrigger>
          <TabsTrigger value="applications">Application Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <JobPipelineView 
            jobs={jobs} 
            onUpdateJobStatus={(jobId, newStatus, reason) => 
              updateJobStatusMutation.mutate({ jobId, newStatus, reason })
            }
            onNavigateToJob={(jobId: number) => {
              // Navigate to Recruitment -> Job Postings tab and highlight specific job
              setLocation(`/recruitment?tab=jobs&jobId=${jobId}`);
            }}
          />
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          <ApplicationPipelineView
            jobs={jobs}
            selectedJob={selectedJob}
            onMoveApplication={(applicationId, newStage, reason) =>
              moveApplicationMutation.mutate({ applicationId, newStage, reason })
            }
            onNavigateToCandidate={(candidateId: number) => {
              // Navigate to Recruitment -> Candidates tab and highlight specific candidate
              setLocation(`/recruitment?tab=candidates&candidateId=${candidateId}`);
            }}
            onSelectJob={setSelectedJob}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JobPipelineView({ 
  jobs, 
  onUpdateJobStatus, 
  onNavigateToJob 
}: { 
  jobs: Job[]; 
  onUpdateJobStatus: (jobId: number, newStatus: string, reason?: string) => void;
  onNavigateToJob: (jobId: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
      {jobStages.map((stage) => {
        const stageJobs = jobs.filter(job => job.status === stage.id);
        
        return (
          <div key={stage.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{stage.name}</h3>
              <Badge variant="secondary" className={stage.color}>
                {stageJobs.length}
              </Badge>
            </div>
            
            <div className="space-y-2 min-h-[400px] p-2 bg-gray-50 rounded-lg">
              {stageJobs.map((job) => (
                <JobCard 
                  key={job.id}
                  job={job}
                  onUpdateStatus={(newStatus, reason) => onUpdateJobStatus(job.id, newStatus, reason)}
                  onNavigateToJob={() => onNavigateToJob(job.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ApplicationPipelineView({ 
  jobs, 
  selectedJob, 
  onMoveApplication, 
  onNavigateToCandidate,
  onSelectJob 
}: { 
  jobs: Job[]; 
  selectedJob: number | null;
  onMoveApplication: (applicationId: number, newStage: string, reason?: string) => void;
  onNavigateToCandidate: (candidateId: number) => void;
  onSelectJob: (jobId: number | null) => void;
}) {
  const filteredJobs = selectedJob ? jobs.filter(job => job.id === selectedJob) : jobs;
  const allApplications = filteredJobs.flatMap(job => 
    job.applications.map(app => ({ ...app, jobTitle: job.title }))
  );

  return (
    <div className="space-y-4">
      {/* Job Filter */}
      <div className="flex items-center gap-4">
        <Label>Filter by Job:</Label>
        <Select value={selectedJob?.toString() || 'all'} onValueChange={(value) => 
          onSelectJob(value === 'all' ? null : parseInt(value))
        }>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All Jobs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Jobs</SelectItem>
            {jobs.map((job) => (
              <SelectItem key={job.id} value={job.id.toString()}>
                {job.title} ({job.applications.length} applications)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Application Kanban */}
      <div className="grid grid-cols-1 lg:grid-cols-9 gap-4">
        {applicationStages.map((stage) => {
          const stageApplications = allApplications.filter(app => app.currentStage === stage.id);
          
          return (
            <div key={stage.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs">{stage.name}</h3>
                <Badge variant="secondary" className={stage.color}>
                  {stageApplications.length}
                </Badge>
              </div>
              
              <div className="space-y-2 min-h-[400px] p-2 bg-gray-50 rounded-lg">
                {stageApplications.map((application) => (
                  <ApplicationCard 
                    key={application.id}
                    application={application}
                    onMove={(newStage, reason) => onMoveApplication(application.id, newStage, reason)}
                    onNavigateToCandidate={() => onNavigateToCandidate(application.candidateId)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JobCard({ 
  job, 
  onUpdateStatus, 
  onNavigateToJob 
}: { 
  job: Job; 
  onUpdateStatus: (newStatus: string, reason?: string) => void;
  onNavigateToJob: (jobId: number) => void;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState(job.status);
  const [reason, setReason] = useState('');

  const handleStatusUpdate = () => {
    onUpdateStatus(newStatus, reason);
    setIsDialogOpen(false);
    setReason('');
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigateToJob(job.id);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="space-y-2">
          <button 
            onClick={handleTitleClick}
            className="font-medium text-sm line-clamp-2 text-left text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 w-full"
          >
            {job.title}
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </button>
          
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>By {job.createdByName}</span>
            <span>{job.applications.length} apps</span>
          </div>
          
          <div className="flex justify-center">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs w-full">
                  Move
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Job Status</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>New Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {jobStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Reason (Optional)</Label>
                    <Textarea 
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Enter reason for status change..."
                    />
                  </div>
                  
                  <Button onClick={handleStatusUpdate} className="w-full">
                    Update Status
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ApplicationCard({ 
  application, 
  onMove,
  onNavigateToCandidate 
}: { 
  application: Application & { jobTitle: string }; 
  onMove: (newStage: string, reason?: string) => void;
  onNavigateToCandidate: (candidateId: number) => void;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newStage, setNewStage] = useState(application.currentStage);
  const [reason, setReason] = useState('');

  const handleMove = () => {
    console.log(`🔄 FRONTEND: ApplicationCard handleMove triggered - ID: ${application.id}, NewStage: ${newStage}, Reason: ${reason}`);
    onMove(newStage, reason);
    setIsDialogOpen(false);
    setReason('');
  };

  const handleCandidateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigateToCandidate(application.candidateId);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="space-y-2">
          <button 
            onClick={handleCandidateClick}
            className="font-medium text-sm line-clamp-1 text-left text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 w-full"
          >
            {application.candidateName}
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </button>
          <p className="text-xs text-gray-600 line-clamp-1">{application.jobTitle}</p>
          
          {application.matchPercentage && (
            <div className="flex items-center gap-1">
              <div className="text-xs text-gray-600">Match:</div>
              <Badge variant="outline" className="text-xs">
                {application.matchPercentage}%
              </Badge>
            </div>
          )}
          
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>{application.candidateExperience}y exp</span>
            <span>{new Date(application.appliedAt).toLocaleDateString()}</span>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full text-xs">
                Move
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Move Application</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>New Stage</Label>
                  <Select value={newStage} onValueChange={setNewStage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {applicationStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Reason (Optional)</Label>
                  <Textarea 
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for moving application..."
                  />
                </div>
                
                <Button onClick={handleMove} className="w-full">
                  Move Application
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}