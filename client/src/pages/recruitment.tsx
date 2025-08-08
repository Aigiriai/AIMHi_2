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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { BrainIcon, BriefcaseIcon, UsersIcon, PercentIcon, BellIcon, SearchIcon, DownloadIcon, PlusIcon, UploadIcon, ExternalLinkIcon, CalendarIcon, Trash2Icon, LayoutDashboard, Users, Calendar, BarChart3, FileBarChart, CloudIcon } from "lucide-react";
import JobPostingModal from "@/components/job-posting-modal";
import ResumeUploadModal from "@/components/resume-upload-modal";
import JobBoardIntegration from "@/components/job-board-integration";
import EnhancedInterviewModal from "@/components/enhanced-interview-modal";
import AdvancedAIMatchingModal from "@/components/advanced-ai-matching-modal";
import InterviewsTable from "@/components/interviews-table";
import ResultsTable from "@/components/results-table";
import JobAssignmentModal from "@/components/job-assignment-modal";
import { CandidateAssignmentModal } from "@/components/candidate-assignment-modal";
import { PipelineKanban } from "@/components/pipeline-kanban";
import { ApplyToJobDropdown } from "@/components/apply-to-job-dropdown";
import { SimpleReportBuilder } from "@/components/reporting/SimpleReportBuilder";

import type { JobMatchResult, Job, Candidate, InterviewWithDetails } from "@shared/schema";
import * as XLSX from 'xlsx';
import { authService } from "@/lib/auth";

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
  const [showDeletionWarning, setShowDeletionWarning] = useState(false);
  const [deletionImpact, setDeletionImpact] = useState<any>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [jobToDelete, setJobToDelete] = useState<{id: number, title: string} | null>(null);

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

  const { data: jobs = [], isLoading: jobsLoading, error: jobsError } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    // Override global 4-hour cache for frequently changing data
    staleTime: 0,               // Always fetch fresh data - temporarily for debugging
    gcTime: 1000,               // Keep in cache for 1 second - temporarily for debugging  
    refetchOnMount: true,       // Always fetch fresh data when component mounts
  });

  // Debug jobs query
  console.log('📋 JOBS_QUERY: Loading:', jobsLoading, 'Error:', jobsError, 'Count:', jobs?.length || 0, 'Jobs:', jobs?.slice(0,2));

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
    // Override global 4-hour cache for frequently changing data  
    staleTime: 2 * 60 * 1000,   // 2 minutes for candidates
    gcTime: 10 * 60 * 1000,     // Keep in cache for 10 minutes
    refetchOnMount: true,       // Always fetch fresh data when component mounts
  });

  const { data: interviews = [], isLoading: interviewsLoading } = useQuery<InterviewWithDetails[]>({
    queryKey: ["/api/interviews"],
  });

  // Get current user info for permission checking
  const { data: currentUser, error: userError, isLoading: userLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Debug user query
  console.log('🔐 USER_QUERY: Loading:', userLoading, 'Error:', userError, 'Data:', currentUser);

  // FALLBACK: Use cached user data if API fails (temporary fix for token issues)
  const cachedUser = authService.getUser();
  const effectiveUser = currentUser || cachedUser;
  
  // Add debugging for user permissions
  console.log('🔐 PERMISSIONS: API user data:', currentUser);
  console.log('🔐 PERMISSIONS: Cached user data:', cachedUser);
  console.log('🔐 PERMISSIONS: Effective user:', effectiveUser);
  console.log('🔐 PERMISSIONS: User role:', effectiveUser?.role);

  // Comprehensive permission checks based on the Detailed Permission Matrix
  const userRole = effectiveUser?.role;
  
  // Job Management Permissions
  const canCreateJobs = userRole && ['super_admin', 'org_admin', 'hiring_manager'].includes(userRole);
  console.log('🔐 PERMISSIONS: canCreateJobs =', canCreateJobs, 'for role:', userRole);

  // All role checks using effectiveUser role
  const canEditJobs = userRole && ['super_admin', 'org_admin', 'hiring_manager'].includes(userRole);
  const canChangeJobStatus = userRole && ['super_admin', 'org_admin', 'hiring_manager'].includes(userRole);
  const canDeleteJobs = userRole && ['super_admin', 'org_admin'].includes(userRole);
  
  // Candidate Management Permissions
  const canDeleteCandidates = userRole && ['super_admin', 'org_admin', 'hiring_manager'].includes(userRole);
  
  // Pipeline Visibility Permissions
  const canViewAllJobs = userRole && ['super_admin', 'org_admin', 'hiring_manager'].includes(userRole);
  
  // Configuration Permissions
  const canManagePipelineStages = userRole && ['super_admin', 'org_admin'].includes(userRole);
  const canManageAutomationRules = userRole && ['super_admin', 'org_admin'].includes(userRole);

  const filteredMatches = matches.filter(match =>
    searchTerm === "" ||
    match.job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    match.candidate.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper function to extract skillAnalysis from matchCriteria
  const extractSkillAnalysis = (match: any) => {
    if (!match.matchCriteria) return null;
    
    try {
      const criteria = typeof match.matchCriteria === 'string' 
        ? JSON.parse(match.matchCriteria) 
        : match.matchCriteria;
      return criteria.skillAnalysis || null;
    } catch (error) {
      console.error('Error parsing matchCriteria for skillAnalysis:', error);
      return null;
    }
  };

  const exportResults = () => {
    if (filteredMatches.length === 0) {
      toast({
        title: "No Data to Export",
        description: "Please run AI matching to generate results before exporting.",
        variant: "destructive",
      });
      return;
    }

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Main summary sheet
    const summaryData = [
      ['Job ID', 'Job Title', 'Candidate ID', 'Candidate Name', 'Email', 'Phone', 'Experience (Years)', 'Match Percentage', 'Match Label', 'Status'],
      ...filteredMatches.map(match => [
        match.job.id,
        match.job.title,
        match.candidate.id,
        match.candidate.name,
        match.candidate.email,
        match.candidate.phone,
        match.candidate.experience,
        Math.round(match.matchPercentage),
        calculateMatchLabel(match.matchPercentage, filteredMatches).label,
        match.status || 'Pending'
      ])
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Auto-size columns for better readability
    const summaryColWidths = [
      { wch: 8 },   // Job ID
      { wch: 40 },  // Job Title
      { wch: 12 },  // Candidate ID
      { wch: 20 },  // Candidate Name
      { wch: 25 },  // Email
      { wch: 15 },  // Phone
      { wch: 12 },  // Experience
      { wch: 12 },  // Match %
      { wch: 15 },  // Match Label
      { wch: 10 }   // Status
    ];
    summarySheet['!cols'] = summaryColWidths;
    
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'AI Matching Summary');

    // Create detailed analysis sheets for each candidate
    filteredMatches.forEach((match) => {
      const skillAnalysis = extractSkillAnalysis(match);
      
      if (skillAnalysis) {
        // Parse criteria scores
        let criteriaData = [];
        try {
          const criteria = typeof match.matchCriteria === 'string' 
            ? JSON.parse(match.matchCriteria) 
            : match.matchCriteria;
          
          if (criteria.criteriaScores && criteria.weightedScores) {
            criteriaData = [
              ['Criteria', 'Score (%)', 'Weight (%)', 'Weighted Points'],
              ['Skills Match', criteria.criteriaScores.skillsMatch, 30, criteria.weightedScores.skillsMatch],
              ['Experience Level', criteria.criteriaScores.experienceLevel, 20, criteria.weightedScores.experienceLevel],
              ['Keyword Relevance', criteria.criteriaScores.keywordRelevance, 35, criteria.weightedScores.keywordRelevance],
              ['Professional Depth', criteria.criteriaScores.professionalDepth, 10, criteria.weightedScores.professionalDepth],
              ['Domain Experience', criteria.criteriaScores.domainExperience, 5, criteria.weightedScores.domainExperience],
              ['', '', '', ''],
              ['Overall Match Score', Math.round(match.matchPercentage), '100%', Math.round(match.matchPercentage)]
            ];
          }
        } catch (error) {
          console.error('Error parsing criteria for export:', error);
        }

        // Create detailed analysis data
        const analysisData = [
          ['Candidate Analysis Report'],
          ['Candidate:', match.candidate.name],
          ['Job Position:', match.job.title],
          ['Overall Match:', `${Math.round(match.matchPercentage)}%`],
          [''],
          ['CRITERIA BREAKDOWN'],
          ...criteriaData,
          [''],
          ['DETAILED SKILL ANALYSIS'],
          ['']
        ];

        // Add skill analysis for each criteria
        Object.entries(skillAnalysis).forEach(([criteriaName, analysis]: [string, any]) => {
          const formattedName = criteriaName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          
          analysisData.push([`${formattedName.toUpperCase()}`]);
          analysisData.push(['Skills Present:']);
          if (analysis.skillsHas && analysis.skillsHas.length > 0) {
            analysis.skillsHas.forEach((skill: string) => {
              analysisData.push([`✓ ${skill}`]);
            });
          } else {
            analysisData.push(['None specified']);
          }
          
          analysisData.push(['Skills Missing:']);
          if (analysis.skillsMissing && analysis.skillsMissing.length > 0) {
            analysis.skillsMissing.forEach((skill: string) => {
              analysisData.push([`✗ ${skill}`]);
            });
          } else {
            analysisData.push(['None identified']);
          }
          
          analysisData.push(['Analysis:']);
          analysisData.push([analysis.criteriaExplanation || 'No detailed explanation available']);
          analysisData.push(['']);
        });

        // Create worksheet for this candidate
        const candidateSheet = XLSX.utils.aoa_to_sheet(analysisData);
        
        // Set column widths for better readability
        candidateSheet['!cols'] = [
          { wch: 50 }, // Main content column
          { wch: 15 }, // Secondary column
          { wch: 15 }, // Weight column
          { wch: 15 }  // Points column
        ];
        
        // Safe sheet name (Excel has limitations on sheet names)
        let sheetName = `${match.candidate.name} Analysis`;
        if (sheetName.length > 31) {
          sheetName = `${match.candidate.name.substring(0, 20)} Analysis`;
        }
        // Remove invalid characters for Excel sheet names
        sheetName = sheetName.replace(/[:\\/?*\[\]]/g, '');
        
        XLSX.utils.book_append_sheet(workbook, candidateSheet, sheetName);
      }
    });

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Download the file
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI_Matching_Results_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Generated Excel file with ${filteredMatches.length} matches and detailed analysis sheets.`,
    });
  };

  // Helper function to calculate match label (if not already available)
  const calculateMatchLabel = (percentage: number, allMatches: any[]) => {
    if (percentage >= 85) {
      return { label: 'EXCELLENT', variant: 'default', color: 'bg-green-500 text-white font-bold' };
    } else if (percentage >= 70) {
      return { label: 'GOOD', variant: 'secondary', color: 'bg-blue-500 text-white font-bold' };
    } else if (percentage >= 50) {
      return { label: 'FAIR', variant: 'outline', color: 'bg-yellow-500 text-black font-bold' };
    } else {
      return { label: 'POOR', variant: 'outline', color: 'bg-gray-400 text-black font-bold' };
    }
  };

  const handleDeleteJobClick = async (jobId: number, jobTitle: string) => {
    try {
      // Get job deletion impact
      const response = await fetch(`/api/jobs/${jobId}/deletion-impact`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          toast({
            title: "Access Denied",
            description: "Only Organization Administrators can delete jobs.",
            variant: "destructive",
          });
          return;
        }
        throw new Error("Failed to get deletion impact");
      }
      
      const impactData = await response.json();
      setDeletionImpact(impactData);
      setJobToDelete({ id: jobId, title: jobTitle });
      setShowDeletionWarning(true);
      setConfirmationText("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to check deletion impact",
        variant: "destructive",
      });
    }
  };

  const handleDeleteJobs = async () => {
    if (selectedJobs.length === 0) return;
    
    // For multiple jobs, show them the first job's deletion impact as an example
    if (selectedJobs.length === 1) {
      const selectedJob = jobs.find(job => job.id === selectedJobs[0]);
      if (selectedJob) {
        await handleDeleteJobClick(selectedJob.id, selectedJob.title);
        return;
      }
    }
    
    // For multiple jobs, use old behavior but with better error handling
    setIsDeleting(true);
    try {
      const deletePromises = selectedJobs.map(async (jobId) => {
        const response = await fetch(`/api/jobs/${jobId}`, { 
          method: "DELETE",
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          }
        });
        
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error("Only Organization Administrators can delete jobs");
          }
          throw new Error(`Failed to delete job: ${response.statusText}`);
        }
        
        return response;
      });
      
      await Promise.all(deletePromises);
      
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/stats"] });
      
      toast({
        title: "Success",
        description: `${selectedJobs.length} job posting${selectedJobs.length > 1 ? 's' : ''} deleted successfully`,
      });
      
      setSelectedJobs([]);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete job postings",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmJobDeletion = async () => {
    if (!jobToDelete || confirmationText !== "confirm") {
      return;
    }
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/jobs/${jobToDelete.id}`, { 
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Only Organization Administrators can delete jobs");
        }
        throw new Error(`Failed to delete job: ${response.statusText}`);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/stats"] });
      
      toast({
        title: "Job Deleted",
        description: `"${jobToDelete.title}" and all related data have been permanently deleted.`,
      });
      
      setShowDeletionWarning(false);
      setJobToDelete(null);
      setDeletionImpact(null);
      setConfirmationText("");
      setSelectedJobs([]);
    } catch (error) {
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Failed to delete job",
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
      const deletePromises = selectedCandidates.map(async (candidateId) => {
        const response = await fetch(`/api/candidates/${candidateId}`, { 
          method: "DELETE",
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          }
        });
        
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error("You don't have permission to delete candidates");
          }
          throw new Error(`Failed to delete candidate: ${response.statusText}`);
        }
        
        return response;
      });
      
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
        description: error instanceof Error ? error.message : "Failed to delete candidates",
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

  const downloadResume = async (candidateId: number, candidateName: string) => {
    try {
      const response = await fetch(`/api/candidates/${candidateId}/resume`);

      if (!response.ok) {
        throw new Error("Failed to download resume");
      }

      // Get the filename from Content-Disposition header or use a default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${candidateName.replace(/\s+/g, '_')}_resume.pdf`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Use arrayBuffer to handle binary files correctly
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer]);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: `Resume for ${candidateName} is being downloaded.`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download resume",
        variant: "destructive",
      });
    }
  };

  const downloadJobFile = async (jobId: number, filename: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        }
      });

      if (!response.ok) {
        throw new Error("Failed to download job file");
      }

      // Get the filename from Content-Disposition header or use the original filename
      const contentDisposition = response.headers.get('Content-Disposition');
      let downloadFilename = filename;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          downloadFilename = filenameMatch[1];
        }
      }

      // Use arrayBuffer to handle binary files correctly
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer]);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: `Job file "${filename}" is being downloaded.`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download job file",
        variant: "destructive",
      });
    }
  };

  const handleAssignJob = (jobId: number, jobTitle: string) => {
    setSelectedJobForAssignment({ id: jobId, title: jobTitle });
    setShowAssignmentModal(true);
  };

  // Data Management functions
  const handleClearMatches = async () => {
    try {
      await apiRequest("DELETE", "/api/matches");
      
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

  const handleBackupDatabase = async () => {
    try {
      const response = await fetch("/api/auth/backup-database", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        if (result.message?.includes('development environment')) {
          toast({
            title: "Development Environment",
            description: "Database backups are only available in production environment.",
            variant: "default",
          });
        } else if (result.message?.includes('too recent')) {
          toast({
            title: "Backup Skipped",
            description: "A backup was recently created. Please wait a few minutes before requesting another backup.",
            variant: "default",
          });
        } else {
          throw new Error(result.message || "Failed to create backup");
        }
        return;
      }
      
      toast({
        title: "Backup Successful",
        description: "Database backup has been created and saved to cloud storage.",
      });
    } catch (error) {
      toast({
        title: "Backup Failed",
        description: error instanceof Error ? error.message : "Failed to create database backup.",
        variant: "destructive",
      });
    }
  };

  const tabs = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "jobs", label: "Job Postings", icon: BriefcaseIcon },
    { value: "candidates", label: "Candidates", icon: Users },
    { value: "ai-matching", label: "AI Matching", icon: BrainIcon },
    { value: "pipeline", label: "Pipeline", icon: BarChart3 },
    { value: "reports", label: "Reports", icon: FileBarChart }
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
            <TabsList className="grid w-full grid-cols-6 mb-8">
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
              {/* HIDDEN: Stats Overview - commented out for ATS dashboard space */}
              {/* 
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
              </div>
              */}

              {/* HIDDEN: Quick Actions - commented out for ATS dashboard space */}
              {/*
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
              </div>
              */}

              {/* HIDDEN: Data Management - commented out for ATS dashboard space */}
              {/*
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
              */}

              {/* HIDDEN: Recent AI Matches - commented out for ATS dashboard space */}
              {/*
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
              */}

              {/* System Management - Only visible for Super Admin */}
              {userRole === 'super_admin' && (
                <div className="space-y-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">System Management</h3>
                          <p className="text-sm text-gray-600">
                            Database backup and system maintenance tools (Super Admin Only)
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700"
                          onClick={handleBackupDatabase}
                        >
                          <CloudIcon className="mr-2 h-4 w-4" />
                          Backup Database
                        </Button>
                      </div>
                    
                    <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                      <div className="flex">
                        <div className="ml-3">
                          <p className="text-sm text-blue-700">
                            <strong>Database Backup:</strong> Create a secure backup of your recruitment data to cloud storage. 
                            This ensures your data is safely stored and can be restored if needed.
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            Note: Backups are only available in production environment and are automatically created during critical operations.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              )}

              {/* ATS DASHBOARD SPACE - Ready for high-level statistics, KPIs, charts, and graphs */}
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-8 text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">ATS Dashboard</h2>
                    <p className="text-gray-600 mb-4">
                      This space is ready for high-level ATS dashboard components including:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h3 className="font-semibold text-gray-900 mb-2">📊 Statistics & KPIs</h3>
                        <p className="text-sm text-gray-600">Pipeline metrics, conversion rates, time-to-hire</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h3 className="font-semibold text-gray-900 mb-2">📈 Interactive Charts</h3>
                        <p className="text-sm text-gray-600">Line charts, bar graphs, trend analysis</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h3 className="font-semibold text-gray-900 mb-2">🥧 Pie Charts</h3>
                        <p className="text-sm text-gray-600">Application status distribution, job categories</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Job Postings Tab */}
            <TabsContent value="jobs" className="mt-0">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Job Postings</h2>
                  <div className="flex items-center gap-3">
                    {selectedJobs.length > 0 && canDeleteJobs && (
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
                    {canCreateJobs && (
                      <Button onClick={() => setShowJobModal(true)}>
                        <PlusIcon size={16} className="mr-2" />
                        Post New Job
                      </Button>
                    )}
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
                      <p className="text-gray-500 mb-4">
                        {canCreateJobs ? "Start by posting your first job opening." : "No job postings available for your role."}
                      </p>
                      {canCreateJobs && (
                        <Button onClick={() => setShowJobModal(true)}>Post Your First Job</Button>
                      )}
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
                                    {job.originalFileName && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => downloadJobFile(job.id, job.originalFileName)}
                                      >
                                        <DownloadIcon size={14} className="mr-1" />
                                        Download
                                      </Button>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleAssignJob(job.id, job.title)}
                                    >
                                      <UsersIcon size={14} className="mr-1" />
                                      Assign
                                    </Button>
                                    {canDeleteJobs && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                                        onClick={() => handleDeleteJobClick(job.id, job.title)}
                                      >
                                        <Trash2Icon size={14} className="mr-1" />
                                        Delete
                                      </Button>
                                    )}
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
                    {selectedCandidates.length > 0 && canDeleteCandidates && (
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
                      <p className="text-gray-500 mb-4">
                        {['team_lead', 'recruiter'].includes(currentUser?.role || '') 
                          ? "You can only see candidates assigned to your pipeline. Upload candidates for manager review and assignment."
                          : "Upload resumes to start building your candidate pool."
                        }
                      </p>
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
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => downloadResume(candidate.id, candidate.name)}
                                    >
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
                          onClick={handleClearMatches}
                          disabled={matches.length === 0}
                        >
                          <Trash2Icon className="w-4 h-4 mr-2" />
                          Clear Results
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

            {/* Reports Tab - Custom Report Builder */}
            <TabsContent value="reports" className="mt-0">
              <SimpleReportBuilder />
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

          {/* Job Deletion Warning Modal */}
          <Dialog open={showDeletionWarning} onOpenChange={setShowDeletionWarning}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                  <DialogTitle className="text-red-600">
                    Permanent Job Deletion Warning
                  </DialogTitle>
                </div>
                <DialogDescription className="text-gray-600">
                  You are about to permanently delete "{jobToDelete?.title}". This action cannot be undone and will remove all related data.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-3">The following data will be permanently deleted:</h4>
                  <ul className="space-y-2 text-sm text-red-700">
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      <span>
                        <strong>{deletionImpact?.impact?.applications || 0}</strong> application(s) submitted to this job
                      </span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      <span>
                        <strong>{deletionImpact?.impact?.matches || 0}</strong> AI match(es) generated for this job
                      </span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      <span>
                        <strong>{deletionImpact?.impact?.interviews || 0}</strong> interview record(s) scheduled for this job
                      </span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      <span>
                        <strong>{deletionImpact?.impact?.assignments || 0}</strong> assignment record(s) for team members
                      </span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      <span>
                        <strong>{deletionImpact?.impact?.statusHistory || 0}</strong> status history record(s) tracking job lifecycle
                      </span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      <span>
                        Original uploaded file{deletionImpact?.impact?.hasOriginalFile ? " (will be deleted)" : " (none)"}
                      </span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      <span>
                        AI-generated template{deletionImpact?.impact?.hasTemplate ? " (will be deleted)" : " (none)"}
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Compliance Impact</h4>
                  <p className="text-sm text-yellow-700">
                    You will lose compliance reporting capabilities for this job posting and all associated candidate interactions. 
                    This may affect your ability to demonstrate fair hiring practices and maintain audit trails.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    To confirm deletion, type "confirm" below:
                  </label>
                  <Input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="Type 'confirm' to enable deletion"
                    className="border-red-200 focus:border-red-400"
                  />
                </div>
              </div>

              <DialogFooter className="space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowDeletionWarning(false);
                    setJobToDelete(null);
                    setDeletionImpact(null);
                    setConfirmationText("");
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  disabled={confirmationText !== "confirm" || isDeleting}
                  onClick={confirmJobDeletion}
                >
                  {isDeleting ? "Deleting..." : "Permanently Delete Job"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default RecruitmentDashboard;