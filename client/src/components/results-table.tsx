import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { JobMatchResult } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DownloadIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon, PhoneIcon, Phone, PhoneCall, InfoIcon } from "lucide-react";
import EnhancedSkillAnalysis from "./enhanced-skill-analysis";

interface ResultsTableProps {
  matches: JobMatchResult[];
  isLoading: boolean;
}

interface CriteriaScore {
  name: string;
  score: number;
  weight: number;
  points: number;
}

const ITEMS_PER_PAGE = 10;

// Function to calculate match labels based on absolute thresholds
const calculateMatchLabel = (matchPercentage: number, allMatches: JobMatchResult[]): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string } => {
  if (allMatches.length === 0) return { label: 'No Data', variant: 'outline', color: 'text-gray-500' };
  
  // Use absolute thresholds instead of relative ranking
  if (matchPercentage >= 80) {
    return { label: 'BEST', variant: 'outline', color: 'bg-white text-black border-gray-300 font-bold' };
  } else if (matchPercentage >= 60) {
    return { label: 'V.GOOD', variant: 'outline', color: 'bg-white text-black border-gray-300 font-bold' };
  } else if (matchPercentage >= 40) {
    return { label: 'GOOD', variant: 'outline', color: 'bg-white text-black border-gray-300 font-bold' };
  } else if (matchPercentage >= 20) {
    return { label: 'AVERAGE', variant: 'outline', color: 'bg-white text-black border-gray-300 font-bold' };
  } else {
    return { label: 'POOR', variant: 'outline', color: 'bg-white text-black border-gray-300 font-bold' };
  }
};

export default function ResultsTable({ matches, isLoading }: ResultsTableProps) {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(new Set());
  const [isBatchCalling, setIsBatchCalling] = useState(false);

  const totalPages = Math.ceil(matches.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentMatches = matches.slice(startIndex, endIndex);

  // Parse criteria scores from match_criteria data (preferred) or AI reasoning (fallback)
  const parseCriteriaScores = (match: any, reasoning: string): CriteriaScore[] => {
    // First try to get data from match_criteria (structured data)
    if (match.matchCriteria) {
      const criteria = match.matchCriteria;
      const weights = {
        skills: 30,
        experience: 20,
        keywords: 35,
        professionalDepth: 10,
        domainExperience: 5,
      };
      
      if (criteria.criteriaScores && criteria.weightedScores) {
        return [
          {
            name: 'Skills Match',
            score: criteria.criteriaScores.skillsMatch || 0,
            weight: weights.skills,
            points: criteria.weightedScores.skillsMatch || 0
          },
          {
            name: 'Experience Level',
            score: criteria.criteriaScores.experienceLevel || 0,
            weight: weights.experience,
            points: criteria.weightedScores.experienceLevel || 0
          },
          {
            name: 'Keyword Relevance',
            score: criteria.criteriaScores.keywordRelevance || 0,
            weight: weights.keywords,
            points: criteria.weightedScores.keywordRelevance || 0
          },
          {
            name: 'Professional Depth',
            score: criteria.criteriaScores.professionalDepth || 0,
            weight: weights.professionalDepth,
            points: criteria.weightedScores.professionalDepth || 0
          },
          {
            name: 'Domain Experience',
            score: criteria.criteriaScores.domainExperience || 0,
            weight: weights.domainExperience,
            points: criteria.weightedScores.domainExperience || 0
          }
        ];
      }
    }
    
    // Fallback to parsing from AI reasoning text
    const criteriaLines = reasoning.match(/• (.+): (\d+)% \(Weight: (\d+)% = ([\d.]+) points\)/g);
    if (!criteriaLines) return [];

    return criteriaLines.map(line => {
      const match = line.match(/• (.+): (\d+)% \(Weight: (\d+)% = ([\d.]+) points\)/);
      if (!match) return null;
      
      return {
        name: match[1],
        score: parseInt(match[2]),
        weight: parseInt(match[3]),
        points: parseFloat(match[4])
      };
    }).filter(Boolean) as CriteriaScore[];
  };

  const toggleRowExpansion = (matchKey: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(matchKey)) {
      newExpanded.delete(matchKey);
    } else {
      newExpanded.add(matchKey);
    }
    setExpandedRows(newExpanded);
  };

  const initiateAICall = async (phoneNumber: string, candidateName: string, jobId?: number) => {
    try {
      const response = await fetch("/api/initiate-ai-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phoneNumber, candidateName: candidateName, jobId: jobId })
      });
      
      if (!response.ok) throw new Error("Failed to initiate call");
      
      const result = await response.json();
      toast({
        title: "AI Call Initiated",
        description: `Starting AI interview call with ${candidateName}`,
      });
    } catch (error) {
      toast({
        title: "Call Failed",
        description: "Failed to initiate AI call. Please try again.",
        variant: "destructive",
      });
    }
  };

  const downloadResume = async (candidateId: number, candidateName: string) => {
    try {
      const response = await fetch(`/api/candidates/${candidateId}/resume`);

      if (!response.ok) {
        throw new Error("Failed to download resume");
      }

      const text = await response.text();
      const blob = new Blob([text], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${candidateName.replace(/\s+/g, '_')}_resume.txt`;
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

  // Selection handlers
  const toggleCandidateSelection = (candidateId: number) => {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(candidateId)) {
      newSelected.delete(candidateId);
    } else {
      newSelected.add(candidateId);
    }
    setSelectedCandidates(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCandidates.size === currentMatches.length) {
      setSelectedCandidates(new Set());
    } else {
      const allCandidateIds = new Set(currentMatches.map(match => match.candidate.id));
      setSelectedCandidates(allCandidateIds);
    }
  };

  // Batch calling functionality
  const initiateBatchCalling = async () => {
    if (selectedCandidates.size === 0) {
      toast({
        title: "No Candidates Selected",
        description: "Please select candidates to call.",
        variant: "destructive",
      });
      return;
    }

    setIsBatchCalling(true);
    const selectedMatches = currentMatches.filter(match => selectedCandidates.has(match.candidate.id));
    
    toast({
      title: "Batch Calling Started",
      description: `Initiating calls to ${selectedCandidates.size} selected candidates...`,
    });

    for (let i = 0; i < selectedMatches.length; i++) {
      const match = selectedMatches[i];
      
      try {
        toast({
          title: `Calling ${match.candidate.name}`,
          description: `Call ${i + 1} of ${selectedMatches.length} - ${match.candidate.phone}`,
        });

        const response = await fetch("/api/initiate-ai-call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            phoneNumber: match.candidate.phone, 
            candidateName: match.candidate.name,
            jobId: match.job.id
          })
        });
        
        if (!response.ok) throw new Error("Failed to initiate call");
        
        // Wait 3 seconds between calls to avoid overwhelming the system
        if (i < selectedMatches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        toast({
          title: `Call Failed for ${match.candidate.name}`,
          description: "Moving to next candidate...",
          variant: "destructive",
        });
      }
    }

    setIsBatchCalling(false);
    setSelectedCandidates(new Set());
    
    toast({
      title: "Batch Calling Complete",
      description: `Completed calling sequence for ${selectedMatches.length} candidates.`,
    });
  };



  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Select</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Job ID</TableHead>
              <TableHead>Job Summary</TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Experience</TableHead>
              <TableHead>Match</TableHead>
              <TableHead>Resume</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg mb-2">No matching results found</div>
        <div className="text-gray-400 text-sm">Run AI matching to see candidate recommendations</div>
      </div>
    );
  }

  return (
    <>
      {/* Batch Actions Bar */}
      {selectedCandidates.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-800">
                {selectedCandidates.size} candidate{selectedCandidates.size !== 1 ? 's' : ''} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCandidates(new Set())}
                className="text-blue-700 border-blue-300 hover:bg-blue-100"
              >
                Clear Selection
              </Button>
            </div>
            <Button
              onClick={initiateBatchCalling}
              disabled={isBatchCalling}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isBatchCalling ? (
                <>
                  <PhoneCall className="mr-2 h-4 w-4 animate-pulse" />
                  Calling...
                </>
              ) : (
                <>
                  <PhoneCall className="mr-2 h-4 w-4" />
                  Call Selected ({selectedCandidates.size})
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-medium text-gray-500 uppercase tracking-wider w-12">
                <Checkbox
                  checked={selectedCandidates.size === currentMatches.length && currentMatches.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all candidates"
                />
              </TableHead>
              <TableHead className="font-medium text-gray-500 uppercase tracking-wider">Details</TableHead>
              <TableHead className="font-medium text-gray-500 uppercase tracking-wider">Job ID</TableHead>
              <TableHead className="font-medium text-gray-500 uppercase tracking-wider">Job Summary</TableHead>
              <TableHead className="font-medium text-gray-500 uppercase tracking-wider">Candidate</TableHead>
              <TableHead className="font-medium text-gray-500 uppercase tracking-wider">Contact</TableHead>
              <TableHead className="font-medium text-gray-500 uppercase tracking-wider">Experience</TableHead>
              <TableHead className="font-medium text-gray-500 uppercase tracking-wider">Match</TableHead>
              <TableHead className="font-medium text-gray-500 uppercase tracking-wider">Resume</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentMatches.map((match) => {
              const matchKey = `${match.jobId}-${match.candidateId}`;
              const isExpanded = expandedRows.has(matchKey);
              const criteriaScores = parseCriteriaScores(match, match.aiReasoning || "");
              const hasDetailedBreakdown = criteriaScores.length > 0;

              return (
                <React.Fragment key={matchKey}>
                  <TableRow className="hover:bg-gray-50">
                    <TableCell>
                      <Checkbox
                        checked={selectedCandidates.has(match.candidate.id)}
                        onCheckedChange={() => toggleCandidateSelection(match.candidate.id)}
                        aria-label={`Select ${match.candidate.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      {hasDetailedBreakdown && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRowExpansion(matchKey)}
                          className="p-1 h-6 w-6"
                        >
                          {isExpanded ? (
                            <ChevronUpIcon className="h-4 w-4" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono text-gray-900">
                        JOB-2024-{match.job.id.toString().padStart(3, '0')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900 max-w-xs">
                        {match.job.title} - {match.job.description.slice(0, 50)}...
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">
                            {getInitials(match.candidate.name)}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{match.candidate.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{match.candidate.email}</div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">{match.candidate.phone}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => initiateAICall(match.candidate.phone, match.candidate.name, match.job.id)}
                          className="p-1 h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          title="Start AI Interview Call"
                        >
                          <PhoneIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-900">{match.candidate.experience} years</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start space-y-1">
                        <span className="text-lg font-bold text-gray-900">
                          {Math.round(match.matchPercentage)}%
                        </span>
                        <div className="flex items-center space-x-1">
                          {(() => {
                            const matchLabel = calculateMatchLabel(match.matchPercentage, matches);
                            return (
                              <Badge 
                                variant="outline" 
                                className="bg-white text-black border-gray-400 font-bold hover:bg-white text-xs"
                                style={{ backgroundColor: 'white', color: 'black', borderColor: '#9ca3af' }}
                              >
                                {matchLabel.label}
                              </Badge>
                            );
                          })()}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 hover:bg-gray-100"
                              >
                                <InfoIcon className="h-3 w-3 text-gray-500" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>AI Matching Analysis - {match.candidate.name}</DialogTitle>
                              </DialogHeader>
                              <div className="mt-4">
                                <EnhancedSkillAnalysis
                                  candidateName={match.candidate.name}
                                  matchPercentage={match.matchPercentage}
                                  criteriaScores={{
                                    skillsMatch: criteriaScores.find(c => c.name === 'Skills Match')?.score || 0,
                                    experienceLevel: criteriaScores.find(c => c.name === 'Experience Level')?.score || 0,
                                    keywordRelevance: criteriaScores.find(c => c.name === 'Keyword Relevance')?.score || 0,
                                    professionalDepth: criteriaScores.find(c => c.name === 'Professional Depth')?.score || 0,
                                    domainExperience: criteriaScores.find(c => c.name === 'Domain Experience')?.score || 0,
                                  }}
                                  weightedScores={{
                                    skillsMatch: criteriaScores.find(c => c.name === 'Skills Match')?.points || 0,
                                    experienceLevel: criteriaScores.find(c => c.name === 'Experience Level')?.points || 0,
                                    keywordRelevance: criteriaScores.find(c => c.name === 'Keyword Relevance')?.points || 0,
                                    professionalDepth: criteriaScores.find(c => c.name === 'Professional Depth')?.points || 0,
                                    domainExperience: criteriaScores.find(c => c.name === 'Domain Experience')?.points || 0,
                                  }}
                                  skillAnalysis={(match as any).skillAnalysis}
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadResume(match.candidate.id, match.candidate.name)}
                        className="text-primary hover:text-primary/80"
                      >
                        <DownloadIcon className="mr-1 h-4 w-4" />
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded criteria breakdown row */}
                  {isExpanded && hasDetailedBreakdown && (
                    <TableRow key={`${matchKey}-details`}>
                      <TableCell colSpan={9} className="bg-gray-50 p-0">
                        <Card className="m-4 border-0 shadow-none">
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Match Criteria Breakdown</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {criteriaScores.map((criteria, index) => (
                                  <div key={index} className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-medium text-gray-600">{criteria.name}</span>
                                      <span className="text-xs text-gray-500">Weight: {criteria.weight}%</span>
                                    </div>
                                    <Progress value={criteria.score} className="h-2" />
                                    <div className="flex justify-between text-xs text-gray-500">
                                      <span>{criteria.score}%</span>
                                      <span>{criteria.points} pts</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="flex-1 flex justify-between sm:hidden">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
                <span className="font-medium">{Math.min(endIndex, matches.length)}</span> of{" "}
                <span className="font-medium">{matches.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="rounded-l-md"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="border-l-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-r-md border-l-0"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
