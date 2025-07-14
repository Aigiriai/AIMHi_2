import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar, Clock, Video, Phone, MapPin, User, Mail, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Job, Candidate, JobMatchResult } from "@shared/schema";

const interviewSchema = z.object({
  jobId: z.number().min(1, "Please select a job"),
  candidateId: z.number().min(1, "Please select a candidate"),
  type: z.enum(["video", "phone", "in-person"], {
    required_error: "Please select an interview type",
  }),
  date: z.date({
    required_error: "Please select a date",
  }),
  time: z.string().min(1, "Please select a time"),
  duration: z.number().min(15, "Duration must be at least 15 minutes"),
  interviewer: z.string().min(1, "Please enter interviewer name"),
  interviewerEmail: z.string().email("Please enter a valid email"),
  location: z.string().optional(),
  meetingLink: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
});

type InterviewFormData = z.infer<typeof interviewSchema>;

interface EnhancedInterviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedJob?: Job;
  preSelectedCandidate?: Candidate;
  preSelectedMatch?: JobMatchResult;
  onSuccess?: () => void;
}

export default function EnhancedInterviewModal({ 
  open, 
  onOpenChange, 
  preSelectedJob,
  preSelectedCandidate,
  preSelectedMatch,
  onSuccess 
}: EnhancedInterviewModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch jobs and candidates for selection
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    enabled: open,
  });

  const { data: candidates = [] } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
    enabled: open,
  });

  const form = useForm<InterviewFormData>({
    resolver: zodResolver(interviewSchema),
    defaultValues: {
      jobId: preSelectedJob?.id || 0,
      candidateId: preSelectedCandidate?.id || 0,
      type: "video",
      duration: 60,
      interviewer: "",
      interviewerEmail: "",
      location: "",
      meetingLink: "",
      notes: "",
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async (data: InterviewFormData) => {
      const response = await apiRequest("POST", "/api/interviews", {
        jobId: data.jobId,
        candidateId: data.candidateId,
        scheduledDateTime: `${format(data.date, "yyyy-MM-dd")}T${data.time}`,
        duration: data.duration,
        interviewType: data.type,
        status: "scheduled",
        meetingLink: data.meetingLink || null,
        notes: data.notes || null,
        interviewerName: data.interviewer,
        interviewerEmail: data.interviewerEmail,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Interview Scheduled",
        description: "The interview has been successfully scheduled.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      form.reset();
      setSelectedDate(undefined);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to schedule interview",
      });
    },
  });

  const onSubmit = (data: InterviewFormData) => {
    scheduleMutation.mutate(data);
  };

  const generateMeetingLink = () => {
    const meetingId = Math.random().toString(36).substr(2, 9);
    form.setValue("meetingLink", `https://meet.google.com/${meetingId}`);
  };

  const timeSlots = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Interview
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Job and Candidate Selection */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="jobId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Job Position
                    </FormLabel>
                    <Select onValueChange={(value) => field.onChange(Number(value))} 
                            value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select job position" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {jobs.map((job: Job) => (
                          <SelectItem key={job.id} value={job.id.toString()}>
                            {job.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="candidateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Candidate
                    </FormLabel>
                    <Select onValueChange={(value) => field.onChange(Number(value))} 
                            value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select candidate" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {candidates.map((candidate: Candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id.toString()}>
                            {candidate.name} - {candidate.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Interview Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interview Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select interview type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="video">
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4" />
                          Video Call
                        </div>
                      </SelectItem>
                      <SelectItem value="phone">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Phone Call
                        </div>
                      </SelectItem>
                      <SelectItem value="in-person">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          In Person
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date and Time Selection */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Interview Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={`w-full pl-3 text-left font-normal ${
                              !field.value && "text-muted-foreground"
                            }`}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <Calendar className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Time
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Duration */}
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (minutes)</FormLabel>
                  <Select onValueChange={(value) => field.onChange(Number(value))} 
                          value={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Interviewer Details */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="interviewer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interviewer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter interviewer name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interviewerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Interviewer Email
                    </FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="interviewer@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Location/Meeting Link */}
            {form.watch("type") === "in-person" ? (
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Enter meeting location" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="meetingLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Meeting Link
                    </FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="https://meet.google.com/..." {...field} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={generateMeetingLink}
                        className="shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                        Generate
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter any additional notes or special instructions..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={scheduleMutation.isPending}>
                {scheduleMutation.isPending ? "Scheduling..." : "Schedule Interview"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}