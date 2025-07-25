import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Users, Trash2, UserCheck } from "lucide-react";

interface JobAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: number;
  jobTitle: string;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface JobAssignment {
  id: number;
  userId: number;
  role: string;
  assignedBy: number;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

export default function JobAssignmentModal({
  open,
  onOpenChange,
  jobId,
  jobTitle,
}: JobAssignmentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("assigned");

  // Fetch team members
  const { data: usersResponse, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
    enabled: open,
  });

  // Extract users array from response object
  const users = (usersResponse as any)?.users || [];

  // Fetch current job assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<JobAssignment[]>({
    queryKey: ["/api/jobs", jobId, "assignments"],
    enabled: open,
  });

  // Assign user to job
  const assignUser = useMutation({
    mutationFn: async (data: { userId: number; role: string }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/assignments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "assignments"] });
      toast({
        title: "Success",
        description: "User assigned to job successfully",
      });
      setSelectedUserId("");
      setSelectedRole("assigned");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign user",
        variant: "destructive",
      });
    },
  });

  // Remove assignment
  const removeAssignment = useMutation({
    mutationFn: async (assignmentId: number) => {
      return apiRequest("DELETE", `/api/jobs/${jobId}/assignments/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "assignments"] });
      toast({
        title: "Success",
        description: "Assignment removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove assignment",
        variant: "destructive",
      });
    },
  });

  const handleAssign = () => {
    if (!selectedUserId) return;
    
    assignUser.mutate({
      userId: parseInt(selectedUserId),
      role: selectedRole,
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "assigned":
        return "secondary";
      case "viewer":
        return "outline";
      default:
        return "outline";
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case "owner":
        return "Full control - can edit job and manage all applications";
      case "assigned":
        return "Can work with candidates but cannot edit job details";
      case "viewer":
        return "Read-only access to job and applications";
      default:
        return "";
    }
  };

  // Filter out already assigned users
  const availableUsers = users.filter((user: any) => 
    !assignments.some((assignment: any) => assignment.userId === user.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Job Assignments
          </DialogTitle>
          <DialogDescription>
            Assign team members to "{jobTitle}" and manage their permissions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Assign New User
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select User</Label>
                  {usersLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a team member" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers.map((user: any) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            <div className="flex items-center gap-2">
                              <span>{user.firstName} {user.lastName}</span>
                              <Badge variant="outline" className="text-xs">
                                {user.role}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Assignment Role</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedRole && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>{selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}:</strong>{" "}
                    {getRoleDescription(selectedRole)}
                  </p>
                </div>
              )}

              <Button 
                onClick={handleAssign}
                disabled={!selectedUserId || assignUser.isPending}
                className="w-full"
              >
                {assignUser.isPending ? "Assigning..." : "Assign User"}
              </Button>
            </CardContent>
          </Card>

          {/* Current Assignments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Current Assignments ({assignments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assignmentsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : assignments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No users assigned to this job yet
                </p>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment: any) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">
                            {assignment.user?.firstName || 'Unknown'} {assignment.user?.lastName || 'User'}
                          </p>
                          <p className="text-sm text-gray-500">{assignment.user?.email || 'No email'}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={getRoleBadgeVariant(assignment.role)}>
                            {assignment.role}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {assignment.user?.role || 'Unknown'}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAssignment.mutate(assignment.id)}
                        disabled={removeAssignment.isPending}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Role Permissions Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Role Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge variant="default">Owner</Badge>
                  <p className="text-sm">Can edit job details, manage all applications, assign others</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="secondary">Assigned</Badge>
                  <p className="text-sm">Can move candidates through pipeline, schedule interviews</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline">Viewer</Badge>
                  <p className="text-sm">Read-only access to job and applications</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}