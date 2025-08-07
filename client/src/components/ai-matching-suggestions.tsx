import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, UserPlus, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Suggestion {
  matchId: number;
  jobId: number;
  candidateId: number;
  overallScore: number;
  jobTitle: string;
  candidateName: string;
  candidateEmail: string;
}

interface AiMatchingSuggestionsProps {
  minScore?: number;
  maxResults?: number;
  onApplicationCreated?: () => void;
}

export function AiMatchingSuggestions({ 
  minScore = 70, 
  maxResults = 10,
  onApplicationCreated 
}: AiMatchingSuggestionsProps) {
  const [currentMinScore, setCurrentMinScore] = useState(minScore);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get AI matching suggestions - using global queryFn with authentication
  const { data: suggestionsData, isLoading, refetch } = useQuery({
    queryKey: [`/api/applications/suggestions?minScore=${currentMinScore}`],
    // Global queryFn automatically handles authentication via getAuthHeaders()
  });

  const suggestions = Array.isArray(suggestionsData) ? suggestionsData : (suggestionsData?.suggestions || []);

  // Generate more matches mutation
  const generateMatchesMutation = useMutation({
    mutationFn: async () => {
      console.log('🎯 AI MATCHING: Starting batch matching generation...');
      return apiRequest('POST', '/api/matches/batch-generate', {});
    },
    onSuccess: () => {
      toast({
        title: "✨ AI Matching Complete",
        description: "Generated new job-candidate matches. Refreshing suggestions...",
      });
      // Refresh suggestions after generating matches
      refetch();
    },
    onError: (error: any) => {
      console.error('❌ Batch matching error:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate new matches. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create application mutation
  const createApplicationMutation = useMutation({
    mutationFn: async ({ jobId, candidateId, candidateName, jobTitle }: { 
      jobId: number; 
      candidateId: number;
      candidateName: string;
      jobTitle: string;
    }) => {
      return apiRequest('POST', `/api/applications`, {
        candidateId,
        jobId,
        source: 'ai_suggestion',
        notes: `Application created from AI matching suggestion: ${candidateName} → ${jobTitle}`
      });
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Application Created",
        description: `${variables.candidateName} has been applied to ${variables.jobTitle}.`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline/stats'] });
      queryClient.invalidateQueries({ queryKey: [`/api/applications/suggestions`] });
      
      onApplicationCreated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Application",
        description: error.message || "Could not create application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateApplication = (suggestion: Suggestion) => {
    createApplicationMutation.mutate({
      candidateId: suggestion.candidateId,
      jobId: suggestion.jobId,
      candidateName: suggestion.candidateName,
      jobTitle: suggestion.jobTitle
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (score >= 80) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (score >= 70) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  const displayedSuggestions = suggestions.slice(0, maxResults);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Matching Suggestions
            </CardTitle>
            <CardDescription>
              High-scoring candidate-job matches ready for application creation
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={currentMinScore}
              onChange={(e) => setCurrentMinScore(parseInt(e.target.value))}
              className="text-sm border rounded px-2 py-1"
            >
              <option value={60}>60%+ matches</option>
              <option value={70}>70%+ matches</option>
              <option value={80}>80%+ matches</option>
              <option value={90}>90%+ matches</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Finding AI matches...
          </div>
        ) : displayedSuggestions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-4 text-gray-400" />
            <p className="mb-2">No high-scoring matches found above {currentMinScore}%</p>
            <p className="text-sm mb-4">Try lowering the minimum score threshold or generate more matches</p>
            <Button
              onClick={() => generateMatchesMutation.mutate()}
              disabled={generateMatchesMutation.isPending}
              variant="outline"
              size="sm"
            >
              {generateMatchesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating Matches...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate More Matches
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedSuggestions.map((suggestion: Suggestion) => (
              <div
                key={`${suggestion.candidateId}-${suggestion.jobId}`}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className={getScoreColor(suggestion.overallScore)}>
                      {suggestion.overallScore}% match
                    </Badge>
                    <span className="font-medium">{suggestion.candidateName}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{suggestion.jobTitle}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {suggestion.candidateEmail}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleCreateApplication(suggestion)}
                  disabled={createApplicationMutation.isPending}
                  className="ml-4"
                >
                  {createApplicationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Create Application
                </Button>
              </div>
            ))}
            
            {suggestions.length > maxResults && (
              <div className="text-center pt-4 text-sm text-muted-foreground">
                Showing {maxResults} of {suggestions.length} suggestions
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}