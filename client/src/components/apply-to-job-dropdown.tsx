import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Job {
  id: number;
  title: string;
  status: string;
}

interface ApplyToJobDropdownProps {
  candidateId: number;
  candidateName: string;
  onApplicationCreated?: () => void;
}

export function ApplyToJobDropdown({ candidateId, candidateName, onApplicationCreated }: ApplyToJobDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get available jobs for this candidate
  const { data: jobsResponse, isLoading } = useQuery({
    queryKey: [`/api/candidates/${candidateId}/available-jobs`],
    enabled: isOpen, // Only fetch when dropdown is opened
  });

  const availableJobs: Job[] = jobsResponse?.jobs || [];

  // Create application mutation
  const createApplicationMutation = useMutation({
    mutationFn: async ({ jobId, candidateId }: { jobId: number; candidateId: number }) => {
      return apiRequest('POST', `/api/applications`, {
        candidateId,
        jobId,
        source: 'manual',
        notes: `Application created via candidate dropdown for ${candidateName}`
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Application Created",
        description: `${candidateName} has been applied to the selected job.`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline/stats'] });
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidateId}/available-jobs`] });
      
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

  const handleApplyToJob = (job: Job) => {
    createApplicationMutation.mutate({
      candidateId,
      jobId: job.id
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
            <Plus className="h-4 w-4" />
          )}
          Apply to Job
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {isLoading ? (
          <DropdownMenuItem disabled>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading jobs...
          </DropdownMenuItem>
        ) : availableJobs.length === 0 ? (
          <DropdownMenuItem disabled>
            No available jobs
          </DropdownMenuItem>
        ) : (
          availableJobs.map((job: Job) => (
            <DropdownMenuItem
              key={job.id}
              onClick={() => handleApplyToJob(job)}
              className="cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="font-medium">{job.title}</span>
                <span className="text-xs text-muted-foreground">
                  Status: {job.status}
                </span>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}