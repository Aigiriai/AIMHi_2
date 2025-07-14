import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Clock, Video, Phone, MapPin, User, Edit, Trash2, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { InterviewWithDetails } from "@shared/schema";

interface InterviewsTableProps {
  interviews: InterviewWithDetails[];
  isLoading: boolean;
  onScheduleNew?: () => void;
}

const statusColors = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  "no-show": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
};

const interviewTypeIcons = {
  video: Video,
  phone: Phone,
  "in-person": MapPin,
};

export default function InterviewsTable({ interviews, isLoading, onScheduleNew }: InterviewsTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest("PATCH", `/api/interviews/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Interview status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update interview status",
        variant: "destructive",
      });
    },
  });

  const deleteInterviewMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        const response = await apiRequest("DELETE", `/api/interviews/${id}`);
        return await response.json();
      } catch (error) {
        console.error("Delete interview error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Interview Deleted",
        description: "Interview has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete interview",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (interviewId: number, newStatus: string) => {
    updateStatusMutation.mutate({ id: interviewId, status: newStatus });
  };

  const handleDelete = (interviewId: number) => {
    if (confirm("Are you sure you want to delete this interview?")) {
      deleteInterviewMutation.mutate(interviewId);
    }
  };

  const openMeetingLink = (link: string) => {
    window.open(link, '_blank');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Interviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (interviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Interviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Interviews Scheduled</h3>
            <p className="text-muted-foreground mb-4">
              Start scheduling interviews with your top candidates
            </p>
            {onScheduleNew && (
              <Button onClick={onScheduleNew}>
                Schedule Interview
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Interviews ({interviews.length})
          </CardTitle>
          {onScheduleNew && (
            <Button onClick={onScheduleNew} size="sm">
              Schedule New
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {interviews.map((interview) => {
            const InterviewIcon = interviewTypeIcons[interview.interviewType as keyof typeof interviewTypeIcons];
            const isUpcoming = new Date(interview.scheduledDateTime) > new Date();
            
            return (
              <div
                key={interview.id}
                className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <InterviewIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{interview.job.title}</span>
                      </div>
                      <Badge className={statusColors[interview.status as keyof typeof statusColors]}>
                        {interview.status}
                      </Badge>
                      {isUpcoming && interview.status === "scheduled" && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Upcoming
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{interview.candidate.name}</span>
                        </div>
                        <div className="text-muted-foreground pl-6">
                          {interview.candidate.email}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{format(new Date(interview.scheduledDateTime), "PPP")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {format(new Date(interview.scheduledDateTime), "p")} 
                            ({interview.duration} min)
                          </span>
                        </div>
                      </div>
                    </div>

                    {interview.interviewerName && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Interviewer:</span> {interview.interviewerName}
                        {interview.interviewerEmail && ` (${interview.interviewerEmail})`}
                      </div>
                    )}

                    {interview.meetingLink && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openMeetingLink(interview.meetingLink!)}
                          className="h-8"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Join Meeting
                        </Button>
                      </div>
                    )}

                    {interview.notes && (
                      <div className="text-sm">
                        <span className="font-medium text-muted-foreground">Notes:</span>
                        <p className="mt-1">{interview.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Select
                      value={interview.status}
                      onValueChange={(value) => handleStatusChange(interview.id, value)}
                      disabled={updateStatusMutation.isPending}
                    >
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="no-show">No Show</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(interview.id)}
                      disabled={deleteInterviewMutation.isPending}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {interview.match && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    <span className="font-medium">AI Match:</span> {interview.match.matchPercentage}% match
                    {interview.match.aiReasoning && (
                      <span className="ml-2">• {interview.match.aiReasoning}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}