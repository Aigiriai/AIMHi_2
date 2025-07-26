import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Candidate {
  id: number;
  name: string;
  email: string;
  experience: string;
}

interface AddCandidateDropdownProps {
  jobId: number;
  jobTitle: string;
  onApplicationCreated?: () => void;
}

export function AddCandidateDropdown({ jobId, jobTitle, onApplicationCreated }: AddCandidateDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get available candidates for this job
  const { data: candidatesResponse, isLoading } = useQuery({
    queryKey: [`/api/jobs/${jobId}/available-candidates`],
    enabled: isOpen, // Only fetch when dropdown is opened
  });

  const availableCandidates: Candidate[] = candidatesResponse?.candidates || [];

  // Create application mutation
  const createApplicationMutation = useMutation({
    mutationFn: async ({ jobId, candidateId }: { jobId: number; candidateId: number }) => {
      return apiRequest('POST', `/api/applications`, {
        candidateId,
        jobId,
        source: 'manual',
        notes: `Application created via job dropdown for ${jobTitle}`
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Application Created",
        description: `Candidate has been applied to ${jobTitle}.`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline/stats'] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/available-candidates`] });
      
      // Close dropdown and notify parent
      setIsOpen(false);
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

  const handleAddCandidate = (candidate: Candidate) => {
    createApplicationMutation.mutate({
      candidateId: candidate.id,
      jobId
    });
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          disabled={createApplicationMutation.isPending}
        >
          {createApplicationMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Add Candidate
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {isLoading ? (
          <DropdownMenuItem disabled>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading candidates...
          </DropdownMenuItem>
        ) : availableCandidates.length === 0 ? (
          <DropdownMenuItem disabled>
            No available candidates
          </DropdownMenuItem>
        ) : (
          availableCandidates.map((candidate: Candidate) => (
            <DropdownMenuItem
              key={candidate.id}
              onClick={() => handleAddCandidate(candidate)}
              className="cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="font-medium">{candidate.name}</span>
                <span className="text-xs text-muted-foreground">
                  {candidate.email}
                </span>
                {candidate.experience && (
                  <span className="text-xs text-muted-foreground">
                    {candidate.experience} years exp.
                  </span>
                )}
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}