import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Users, UserPlus, Eye, Edit, Crown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface Assignment {
  id: number;
  candidateId: number;
  userId: number;
  role: string;
  assignedBy: number;
  createdAt: string;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  userRole: string;
}

interface CandidateAssignmentModalProps {
  candidateId: number;
  candidateName: string;
  trigger?: React.ReactNode;
}

const roleIcons = {
  owner: Crown,
  assigned: Edit,
  viewer: Eye,
};

const roleDescriptions = {
  owner: "Full control - can edit candidate, assign to others, and view all details",
  assigned: "Can work with candidate - view details, add notes, and update status",
  viewer: "Read-only access - can view candidate details but cannot make changes"
};

export function CandidateAssignmentModal({ candidateId, candidateName, trigger }: CandidateAssignmentModalProps) {
  const [open, setOpen] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const fetchAssignments = async () => {
    try {
      setIsLoading(true);
      console.log(`📋 CANDIDATE ASSIGNMENT UI: Fetching assignments for candidate ${candidateId}`);
      
      const response = await fetch(`/api/candidates/${candidateId}/assignments`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAssignments(data.assignments);
          console.log(`✅ CANDIDATE ASSIGNMENT UI: Loaded ${data.assignments.length} assignments`);
        } else {
          console.error('❌ CANDIDATE ASSIGNMENT UI: Failed to fetch assignments:', data);
          toast({
            title: "Error",
            description: "Failed to load candidate assignments",
            variant: "destructive",
          });
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ CANDIDATE ASSIGNMENT UI: Error fetching assignments:', error);
      toast({
        title: "Error",
        description: "Failed to load candidate assignments",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      console.log('📋 CANDIDATE ASSIGNMENT UI: Fetching organization users');
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.users) {
          setUsers(data.users);
          console.log(`✅ CANDIDATE ASSIGNMENT UI: Loaded ${data.users.length} users`);
        } else {
          console.error('❌ CANDIDATE ASSIGNMENT UI: Invalid users response:', data);
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ CANDIDATE ASSIGNMENT UI: Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to load organization users",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (open) {
      fetchAssignments();
      fetchUsers();
    }
  }, [open, candidateId]);

  const handleAssign = async () => {
    if (!selectedUserId || !selectedRole) {
      toast({
        title: "Validation Error",
        description: "Please select both a user and a role",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);
      console.log(`📋 CANDIDATE ASSIGNMENT UI: Creating assignment:`, {
        candidateId,
        userId: parseInt(selectedUserId),
        role: selectedRole
      });

      const response = await fetch(`/api/candidates/${candidateId}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          userId: parseInt(selectedUserId),
          role: selectedRole
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('✅ CANDIDATE ASSIGNMENT UI: Assignment created successfully');
          toast({
            title: "Success",
            description: data.message || "Candidate assigned successfully",
          });
          
          // Reset form
          setSelectedUserId('');
          setSelectedRole('');
          
          // Refresh assignments
          await fetchAssignments();
          
          // Invalidate related queries
          await queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
        } else {
          console.error('❌ CANDIDATE ASSIGNMENT UI: Assignment creation failed:', data);
          toast({
            title: "Error",
            description: data.message || "Failed to assign candidate",
            variant: "destructive",
          });
        }
      } else {
        const errorData = await response.json();
        console.error('❌ CANDIDATE ASSIGNMENT UI: Assignment creation failed:', errorData);
        toast({
          title: "Error",
          description: errorData.message || "Failed to assign candidate",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ CANDIDATE ASSIGNMENT UI: Error creating assignment:', error);
      toast({
        title: "Error",
        description: "Failed to assign candidate",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: number, userName: string) => {
    try {
      console.log(`📋 CANDIDATE ASSIGNMENT UI: Removing assignment ${assignmentId}`);
      
      const response = await fetch(`/api/candidates/${candidateId}/assignments/${assignmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('✅ CANDIDATE ASSIGNMENT UI: Assignment removed successfully');
          toast({
            title: "Success",
            description: `Removed ${userName} from candidate assignments`,
          });
          
          // Refresh assignments
          await fetchAssignments();
          
          // Invalidate related queries
          await queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
        } else {
          console.error('❌ CANDIDATE ASSIGNMENT UI: Assignment removal failed:', data);
          toast({
            title: "Error",
            description: data.message || "Failed to remove assignment",
            variant: "destructive",
          });
        }
      } else {
        const errorData = await response.json();
        console.error('❌ CANDIDATE ASSIGNMENT UI: Assignment removal failed:', errorData);
        toast({
          title: "Error",
          description: errorData.message || "Failed to remove assignment",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ CANDIDATE ASSIGNMENT UI: Error removing assignment:', error);
      toast({
        title: "Error",
        description: "Failed to remove assignment",
        variant: "destructive",
      });
    }
  };

  const getAvailableUsers = () => {
    const assignedUserIds = assignments.map(a => a.userId);
    return users.filter(user => !assignedUserIds.includes(user.id));
  };

  const getRoleIcon = (role: string) => {
    const Icon = roleIcons[role as keyof typeof roleIcons] || Edit;
    return <Icon className="h-4 w-4" />;
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'assigned': return 'secondary';
      case 'viewer': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-1" />
            Assign
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Candidate Assignments
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Assign team members to candidate: <strong>{candidateName}</strong>
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Assignments */}
          <div>
            <h4 className="font-medium mb-3">Current Assignments</h4>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading assignments...</div>
            ) : assignments.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 border rounded-lg">
                No team members assigned to this candidate yet.
              </div>
            ) : (
              <div className="space-y-2">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(assignment.role)}
                        <span className="font-medium">
                          {assignment.userFirstName} {assignment.userLastName}
                        </span>
                      </div>
                      <Badge variant={getRoleBadgeVariant(assignment.role)}>
                        {assignment.role}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {assignment.userRole}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAssignment(assignment.id, `${assignment.userFirstName} ${assignment.userLastName}`)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Assignment */}
          <div>
            <h4 className="font-medium mb-3">Add New Assignment</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Team Member <span className="text-red-500">*</span>
                  </label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableUsers().map((user) => (
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
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleDescriptions).map(([role, description]) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            {getRoleIcon(role)}
                            <span className="capitalize">{role}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedRole && (
                <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                  <strong>Role Description:</strong> {roleDescriptions[selectedRole as keyof typeof roleDescriptions]}
                </div>
              )}

              <Button 
                onClick={handleAssign} 
                disabled={!selectedUserId || !selectedRole || isCreating}
                className="w-full"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {isCreating ? 'Assigning...' : 'Assign to Candidate'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}