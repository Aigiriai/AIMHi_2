import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Brain, Settings, Target, TrendingUp, Award } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequestJson } from "@/lib/queryClient";
import type { Job } from "@shared/schema";

const advancedMatchingSchema = z.object({
  jobId: z.number().min(1, "Please select a job"),
  minMatchPercentage: z.number().min(0).max(100).default(50),
  weights: z.object({
    skills: z.number().min(0).max(100).default(30),
    experience: z.number().min(0).max(100).default(20),
    keywords: z.number().min(0).max(100).default(35),
    technicalDepth: z.number().min(0).max(100).default(10),
    projectDomain: z.number().min(0).max(100).default(5),
  }),
  prioritizeRecent: z.boolean().default(false),
  strictMatchMode: z.boolean().default(false),
});

type AdvancedMatchingFormData = z.infer<typeof advancedMatchingSchema>;

interface AdvancedAIMatchingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function AdvancedAIMatchingModal({ 
  open, 
  onOpenChange, 
  onSuccess 
}: AdvancedAIMatchingModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch jobs for selection
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    enabled: open,
  });

  const form = useForm<AdvancedMatchingFormData>({
    resolver: zodResolver(advancedMatchingSchema),
    defaultValues: {
      jobId: 0,
      minMatchPercentage: 50,
      weights: {
        skills: 30,
        experience: 20,
        keywords: 35,
        technicalDepth: 10,
        projectDomain: 5,
      },
      prioritizeRecent: false,
      strictMatchMode: false,
    },
  });

  // Watch weights to ensure they add up to 100
  const watchedWeights = form.watch("weights");
  const totalWeight = Object.values(watchedWeights || {}).reduce((sum, weight) => sum + weight, 0);

  const runMatchingMutation = useMutation({
    mutationFn: async (data: AdvancedMatchingFormData) => {
      setIsAnalyzing(true);
      const result = await apiRequestJson("POST", "/api/matches/advanced", {
        jobId: data.jobId,
        minMatchPercentage: data.minMatchPercentage,
        weights: data.weights,
        prioritizeRecent: data.prioritizeRecent,
        strictMatchMode: data.strictMatchMode,
      });
      console.log("Advanced matching result:", result);
      return result;
    },
    onSuccess: (results) => {
      setAnalysisResults(results);
      setIsAnalyzing(false);
      toast({
        title: "Advanced AI Matching Complete",
        description: results?.message || `Found ${results?.matches?.length || 0} candidates above ${form.getValues("minMatchPercentage")}% match threshold`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      setIsAnalyzing(false);
      console.error("Advanced matching error:", error);
      toast({
        variant: "destructive",
        title: "Matching Error",
        description: error.message || "Failed to run advanced AI matching",
      });
    },
  });

  const onSubmit = (data: AdvancedMatchingFormData) => {
    if (Math.abs(totalWeight - 100) > 1) {
      toast({
        variant: "destructive",
        title: "Invalid Weights",
        description: "Criteria weights must add up to 100%",
      });
      return;
    }
    runMatchingMutation.mutate(data);
  };

  const resetWeights = () => {
    form.setValue("weights", {
      skills: 30,
      experience: 20,
      keywords: 35,
      technicalDepth: 10,
      projectDomain: 5,
    });
  };

  const presetConfigurations = [
    {
      name: "Technical Focus",
      description: "Prioritizes technical skills and depth",
      weights: { skills: 35, experience: 25, keywords: 20, technicalDepth: 15, projectDomain: 5 }
    },
    {
      name: "Experience Heavy",
      description: "Emphasizes experience and project domain",
      weights: { skills: 20, experience: 40, keywords: 20, technicalDepth: 5, projectDomain: 15 }
    },
    {
      name: "Balanced Approach",
      description: "Equal weight across all criteria",
      weights: { skills: 20, experience: 20, keywords: 20, technicalDepth: 20, projectDomain: 20 }
    },
    {
      name: "Keyword Recency Focus",
      description: "Prioritizes recent keyword usage and skill relevance",
      weights: { skills: 25, experience: 15, keywords: 45, technicalDepth: 10, projectDomain: 5 }
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Advanced AI Matching
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
            {/* Job Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Job Selection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control as any}
                  name="jobId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Job Position</FormLabel>
                      <Select onValueChange={(value) => field.onChange(Number(value))} 
                              value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a job to analyze" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {jobs.map((job: Job) => (
                            <SelectItem key={job.id} value={job.id.toString()}>
                              <div className="flex flex-col">
                                <span className="font-medium">{job.title}</span>
                                <span className="text-sm text-muted-foreground">
                                  {job.experienceLevel} • {job.jobType}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Matching Criteria Weights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Matching Criteria Weights
                </CardTitle>
                <CardDescription>
                  Adjust the importance of each criteria (must total 100%)
                  <Badge variant={totalWeight === 100 ? "default" : "destructive"} className="ml-2">
                    Total: {totalWeight}%
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Preset Configurations */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Quick Presets</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {presetConfigurations.map((preset) => (
                      <Button
                        key={preset.name}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => form.setValue("weights", preset.weights)}
                        className="h-auto p-3 text-left"
                      >
                        <div>
                          <div className="font-medium">{preset.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {preset.description}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Individual Weight Sliders */}
                <div className="space-y-4">
                  <FormField
                    control={form.control as any}
                    name="weights.skills"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="flex items-center gap-2">
                            <Award className="h-4 w-4" />
                            Technical Skills
                          </FormLabel>
                          <Badge variant="outline">{field.value}%</Badge>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={100}
                            step={5}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control as any}
                    name="weights.experience"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Experience Level
                          </FormLabel>
                          <Badge variant="outline">{field.value}%</Badge>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={100}
                            step={5}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control as any}
                    name="weights.keywords"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Keyword Relevance</FormLabel>
                          <Badge variant="outline">{field.value}%</Badge>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={100}
                            step={5}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control as any}
                    name="weights.technicalDepth"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Technical Depth</FormLabel>
                          <Badge variant="outline">{field.value}%</Badge>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={100}
                            step={5}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control as any}
                    name="weights.projectDomain"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Project/Domain Experience</FormLabel>
                          <Badge variant="outline">{field.value}%</Badge>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={100}
                            step={5}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="button" variant="outline" onClick={resetWeights}>
                  Reset to Default
                </Button>
              </CardContent>
            </Card>

            {/* Matching Threshold */}
            <Card>
              <CardHeader>
                <CardTitle>Matching Threshold</CardTitle>
                <CardDescription>
                  Minimum match percentage to include candidates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control as any}
                  name="minMatchPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Minimum Match Percentage</FormLabel>
                        <Badge variant="outline">{field.value}%</Badge>
                      </div>
                      <FormControl>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={runMatchingMutation.isPending || totalWeight !== 100}
                className="min-w-[140px]"
              >
                {isAnalyzing ? (
                  <>
                    <Brain className="mr-2 h-4 w-4 animate-pulse" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    Run Analysis
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}