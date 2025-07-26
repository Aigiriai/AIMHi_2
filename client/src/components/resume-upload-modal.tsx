import { useState } from "react";
import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, UploadIcon, CloudUploadIcon, FileIcon, AlertTriangle } from "lucide-react";
import BulkFileUpload from "./bulk-file-upload";

const resumeFormSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  experience: z.number().min(0).max(50).optional(),
  resume: z.instanceof(File, { message: "Please select a resume file" }),
  submissionNotes: z.string().optional(),
});

type ResumeFormData = z.infer<typeof resumeFormSchema>;

interface ResumeUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function ResumeUploadModal({ open, onOpenChange, onSuccess }: ResumeUploadModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<ResumeFormData | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  
  // Get current user to determine workflow
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  React.useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);
  
  const isLowerRole = ['team_lead', 'recruiter'].includes(currentUser?.role || '');
  const isSubmissionMode = isLowerRole;

  const form = useForm<ResumeFormData>({
    resolver: zodResolver(resumeFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      experience: 0,
      resume: undefined,
      submissionNotes: "",
    },
  });

  const uploadResumeMutation = useMutation({
    mutationFn: async (data: ResumeFormData & { forceOverwrite?: boolean }) => {
      const formData = new FormData();
      
      // For image files, we only need to send the file - AI will extract the data
      const isImageFile = data.resume.type.startsWith('image/');
      
      if (isImageFile) {
        formData.append("resume", data.resume);
      } else {
        // For PDF files, include the manual form data
        formData.append("name", data.name || "");
        formData.append("email", data.email || "");
        formData.append("phone", data.phone || "");
        formData.append("experience", (data.experience || 0).toString());
        formData.append("resume", data.resume);
      }

      // Add submission notes for Team Lead/Recruiter
      if (isSubmissionMode && data.submissionNotes) {
        formData.append("submissionNotes", data.submissionNotes);
      }

      // Add forceOverwrite flag if provided (only for direct uploads)
      if (data.forceOverwrite && !isSubmissionMode) {
        formData.append("forceOverwrite", "true");
      }

      const token = localStorage.getItem('authToken');
      // Use different endpoints based on role
      const endpoint = isSubmissionMode ? "/api/candidate-submissions" : "/api/candidates";
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 409) {
          // Duplicate detected - parse the response for duplicate info
          const duplicateData = await response.json();
          throw new Error(JSON.stringify({ isDuplicate: true, ...duplicateData }));
        }
        const error = await response.text();
        throw new Error(error || "Failed to upload resume");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: data.wasUpdated ? "Candidate profile updated successfully!" : "Resume uploaded successfully!",
      });
      form.reset();
      setDuplicateInfo(null);
      setShowDuplicateDialog(false);
      setPendingFormData(null);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      try {
        const errorData = JSON.parse(error.message);
        if (errorData.isDuplicate) {
          setDuplicateInfo(errorData);
          setShowDuplicateDialog(true);
          return;
        }
      } catch {
        // Not a duplicate error, handle normally
      }
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload resume",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ResumeFormData) => {
    setPendingFormData(data);
    uploadResumeMutation.mutate(data);
  };

  const handleOverwrite = () => {
    if (pendingFormData) {
      uploadResumeMutation.mutate({ ...pendingFormData, forceOverwrite: true });
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      form.setValue("resume", file);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        // Prevent closing during upload operations
        if (!isOpen && (uploadResumeMutation.isPending || isBulkUploading)) {
          return;
        }
        onOpenChange(isOpen);
      }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Upload Resume
              {isBulkUploading && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm font-normal">Processing files...</span>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">
              <UploadIcon className="mr-2 h-4 w-4" />
              Single Resume
            </TabsTrigger>
            <TabsTrigger value="bulk">
              <FileIcon className="mr-2 h-4 w-4" />
              Bulk Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Show instructions for image files */}
                {form.watch("resume")?.type?.startsWith('image/') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <p className="text-sm text-blue-700 font-medium">
                        AI Processing Enabled: Information will be automatically extracted from your resume image
                      </p>
                    </div>
                  </div>
                )}

                {/* Only show manual fields for non-image files */}
                {!form.watch("resume")?.type?.startsWith('image/') && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="+1 (555) 123-4567" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="experience"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Years of Experience</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="5"
                                min="0"
                                max="50"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}

                <FormField
                  control={form.control}
                  name="resume"
                  render={({ field: { onChange, ...field } }) => (
                    <FormItem>
                      <FormLabel>Resume File</FormLabel>
                      <FormControl>
                        <div
                          className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-colors ${
                            dragActive
                              ? "border-primary bg-primary/5"
                              : "border-gray-300 hover:border-primary"
                          }`}
                          onDragEnter={handleDrag}
                          onDragLeave={handleDrag}
                          onDragOver={handleDrag}
                          onDrop={handleDrop}
                        >
                          <div className="space-y-1 text-center">
                            <CloudUploadIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="flex text-sm text-gray-600">
                              <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary/80">
                                <span>Upload a file</span>
                                <input
                                  type="file"
                                  className="sr-only"
                                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) onChange(file);
                                  }}
                                />
                              </label>
                              <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">PDF, Word, image, or text files up to 10MB</p>
                            {form.watch("resume") && (
                              <p className="text-sm text-green-600 font-medium">
                                {form.watch("resume").name}
                              </p>
                            )}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={uploadResumeMutation.isPending}>
                    {uploadResumeMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UploadIcon className="mr-2 h-4 w-4" />
                    )}
                    Upload Resume
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <BulkFileUpload
              uploadType="candidates"
              onSuccess={() => {
                onSuccess?.();
              }}
              onClose={() => onOpenChange(false)}
              onUploadStateChange={setIsBulkUploading}
            />
          </TabsContent>
        </Tabs>
        </DialogContent>
      </Dialog>

      {/* Duplicate Detection Dialog */}
      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Duplicate Candidate Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                A candidate with email <strong>{duplicateInfo?.existingCandidate?.email}</strong> already exists:
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <p className="font-medium">{duplicateInfo?.existingCandidate?.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{duplicateInfo?.existingCandidate?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={duplicateInfo?.contentAnalysis === 'very_similar' ? 'destructive' : 'secondary'}>
                    {duplicateInfo?.similarity}% Similar Content
                  </Badge>
                  <Badge variant="outline">
                    {duplicateInfo?.contentAnalysis === 'very_similar' ? 'Very Similar' : 'Different Content'}
                  </Badge>
                </div>
              </div>
              <p className="text-sm">
                {duplicateInfo?.suggestion}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDuplicateDialog(false);
              setDuplicateInfo(null);
              setPendingFormData(null);
            }}>
              Cancel Upload
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleOverwrite} disabled={uploadResumeMutation.isPending}>
              {uploadResumeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Overwrite Existing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}