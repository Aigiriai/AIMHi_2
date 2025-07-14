import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Brain, Target, Settings, Info } from "lucide-react";
import type { JobTemplate } from "@shared/schema";

interface JobTemplateViewerProps {
  jobId: number;
  jobTitle: string;
}

export default function JobTemplateViewer({ jobId, jobTitle }: JobTemplateViewerProps) {
  const [open, setOpen] = useState(false);

  const { data: template, isLoading } = useQuery<JobTemplate>({
    queryKey: ["/api/job-templates", jobId],
    enabled: open,
  });

  const renderSkillsList = (skills: string[] | null, type: "mandatory" | "preferred") => (
    <div className="space-y-2">
      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
        {type === "mandatory" ? "Must Have" : "Nice to Have"}
      </h4>
      <div className="flex flex-wrap gap-2">
        {skills && skills.length > 0 ? (
          skills.map((skill, index) => (
            <Badge
              key={index}
              variant={type === "mandatory" ? "default" : "secondary"}
              className={type === "mandatory" ? "bg-red-100 text-red-800 hover:bg-red-200" : ""}
            >
              {skill}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">None specified</span>
        )}
      </div>
    </div>
  );

  const renderTechnologies = (primary: string[] | null, secondary: string[] | null) => (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-2">
          Primary Technologies
        </h4>
        <div className="flex flex-wrap gap-2">
          {primary && primary.length > 0 ? (
            primary.map((tech, index) => (
              <Badge key={index} className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                {tech}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">None specified</span>
          )}
        </div>
      </div>
      <div>
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-2">
          Secondary Technologies
        </h4>
        <div className="flex flex-wrap gap-2">
          {secondary && secondary.length > 0 ? (
            secondary.map((tech, index) => (
              <Badge key={index} variant="outline">
                {tech}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">None specified</span>
          )}
        </div>
      </div>
    </div>
  );

  const renderMatchingWeights = (template: JobTemplate) => {
    const skillsWeight = template.skillsMatchWeight || 25;
    const keywordWeight = template.keywordWeight || 35;
    const experienceWeight = template.experienceWeight || 15;
    const technicalWeight = template.technicalDepthWeight || 10;
    const domainWeight = template.domainKnowledgeWeight || 15;
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Skills Match</span>
              <span>{skillsWeight}%</span>
            </div>
            <Progress value={skillsWeight} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Keywords</span>
              <span>{keywordWeight}%</span>
            </div>
            <Progress value={keywordWeight} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Experience</span>
              <span>{experienceWeight}%</span>
            </div>
            <Progress value={experienceWeight} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Technical Depth</span>
              <span>{technicalWeight}%</span>
            </div>
            <Progress value={technicalWeight} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Domain Knowledge</span>
              <span>{domainWeight}%</span>
            </div>
            <Progress value={domainWeight} className="h-2" />
          </div>
        </div>
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground">
            <strong>How it works:</strong> The AI uses these weights to score candidates. 
            Higher weights mean that criteria contributes more to the overall match percentage.
            Total weight: {skillsWeight + keywordWeight + experienceWeight + technicalWeight + domainWeight}%
          </div>
        </div>
      </div>
    );
  };

  const renderRoleBreakdown = (template: JobTemplate) => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-center">{template.technicalTasksPercentage}%</div>
            <div className="text-sm text-muted-foreground text-center">Technical Tasks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-center">{template.leadershipTasksPercentage}%</div>
            <div className="text-sm text-muted-foreground text-center">Leadership Tasks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-center">{template.domainTasksPercentage}%</div>
            <div className="text-sm text-muted-foreground text-center">Domain Tasks</div>
          </CardContent>
        </Card>
      </div>
      <div className="text-sm text-muted-foreground">
        <div className="flex items-center gap-2 mb-1">
          <Info className="h-4 w-4" />
          <span>Role Analysis</span>
        </div>
        <div className="ml-6 space-y-1">
          <div>• <strong>Position:</strong> {template.positionTitle}</div>
          <div>• <strong>Seniority:</strong> {template.seniorityLevel}</div>
          <div>• <strong>Department:</strong> {template.department || "Not specified"}</div>
          <div>• <strong>Min Experience:</strong> {template.minimumYearsRequired} years</div>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          View Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            JD Template Analysis: {jobTitle}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh]">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : template ? (
            <Tabs defaultValue="skills" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="skills">Skills</TabsTrigger>
                <TabsTrigger value="technologies">Technologies</TabsTrigger>
                <TabsTrigger value="role">Role Analysis</TabsTrigger>
                <TabsTrigger value="matching">Matching Weights</TabsTrigger>
              </TabsList>
              
              <TabsContent value="skills" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Skills Requirements
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {renderSkillsList(template.mandatorySkills, "mandatory")}
                    {renderSkillsList(template.preferredSkills, "preferred")}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="technologies" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Technology Stack
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderTechnologies(template.primaryTechnologies || [], template.secondaryTechnologies || [])}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="role" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      Role Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderRoleBreakdown(template)}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="matching" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      AI Matching Criteria Weights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderMatchingWeights(template)}
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <div className="text-sm text-muted-foreground">
                        <strong>How it works:</strong> The AI uses these weights to score candidates. 
                        Higher weights mean that criteria contributes more to the overall match percentage.
                        Total weight: {template.skillsMatchWeight + template.keywordWeight + template.experienceWeight + template.technicalDepthWeight + template.domainKnowledgeWeight}%
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <div className="text-lg font-medium">Template Not Available</div>
              <div className="text-sm text-muted-foreground">
                Job template analysis has not been generated for this position yet.
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}