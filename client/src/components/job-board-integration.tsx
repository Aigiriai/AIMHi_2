import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { SearchIcon, DownloadIcon, UploadIcon, ExternalLinkIcon, CheckCircleIcon, AlertCircleIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface JobBoardSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LinkedInJob {
  id: string;
  title: string;
  description: string;
  company: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  skills: string[];
  postedDate: string;
}

interface IndeedJob {
  jobkey: string;
  jobtitle: string;
  company: string;
  formattedLocation: string;
  snippet: string;
  url: string;
  date: string;
}

export default function JobBoardIntegration({ open, onOpenChange }: JobBoardSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState("");
  const [activeTab, setActiveTab] = useState("search");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check credentials status
  const { data: credentialsStatus } = useQuery({
    queryKey: ["/api/job-boards/credentials"],
  });

  // Search job boards
  const searchMutation = useMutation({
    mutationFn: async ({ query, location }: { query: string; location?: string }) => {
      const params = new URLSearchParams({ query });
      if (location) params.append('location', location);
      
      const response = await apiRequest("GET", `/api/job-boards/search?${params}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Search Complete",
        description: `Found ${data.total.combined} jobs across platforms`,
      });
    },
    onError: () => {
      toast({
        title: "Search Failed",
        description: "Unable to search job boards. Check your API credentials.",
        variant: "destructive",
      });
    },
  });

  // Import job mutation
  const importMutation = useMutation({
    mutationFn: async ({ source, jobData }: { source: string; jobData: any }) => {
      const response = await apiRequest("POST", "/api/job-boards/import", { source, jobData });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Job imported successfully into AIM Hi System!",
      });
    },
  });

  // Post job to external platforms
  const postMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await apiRequest("POST", `/api/job-boards/post/${jobId}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Job Posted",
        description: `Posted to LinkedIn: ${data.results.linkedIn ? 'Success' : 'Failed'}, Indeed: ${data.results.indeed ? 'Success' : 'Failed'}`,
      });
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search Required",
        description: "Please enter a search query",
        variant: "destructive",
      });
      return;
    }
    searchMutation.mutate({ query: searchQuery, location });
  };

  const handleImportJob = (source: string, jobData: any) => {
    importMutation.mutate({ source, jobData });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLinkIcon size={20} />
            Job Board Integration
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">Search & Import</TabsTrigger>
            <TabsTrigger value="post">Post Jobs</TabsTrigger>
            <TabsTrigger value="credentials">Setup</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="search-query">Search Query</Label>
                  <Input
                    id="search-query"
                    placeholder="e.g., Software Engineer, Data Scientist, Marketing Manager"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location (Optional)</Label>
                  <Input
                    id="location"
                    placeholder="e.g., New York, NY"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={searchMutation.isPending}
                className="w-full md:w-auto"
              >
                <SearchIcon size={16} className="mr-2" />
                {searchMutation.isPending ? "Searching..." : "Search Job Boards"}
              </Button>
            </div>

            {searchMutation.data && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {searchMutation.data.total.linkedIn}
                      </div>
                      <div className="text-sm text-gray-600">LinkedIn Jobs</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-800">
                        {searchMutation.data.total.indeed}
                      </div>
                      <div className="text-sm text-gray-600">Indeed Jobs</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {searchMutation.data.total.combined}
                      </div>
                      <div className="text-sm text-gray-600">Total Found</div>
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="linkedin">
                  <TabsList>
                    <TabsTrigger value="linkedin">
                      LinkedIn Jobs ({searchMutation.data.total.linkedIn})
                    </TabsTrigger>
                    <TabsTrigger value="indeed">
                      Indeed Jobs ({searchMutation.data.total.indeed})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="linkedin" className="space-y-4">
                    {searchMutation.data.results.linkedIn.map((job: LinkedInJob) => (
                      <Card key={job.id}>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold">{job.title}</h3>
                              <p className="text-gray-600">{job.company} • {job.location}</p>
                              <p className="text-sm text-gray-500 mt-2 line-clamp-3">
                                {job.description}
                              </p>
                              <div className="flex gap-2 mt-3">
                                <Badge variant="secondary">{job.experienceLevel}</Badge>
                                <Badge variant="outline">{job.employmentType}</Badge>
                                {job.skills.slice(0, 3).map((skill, idx) => (
                                  <Badge key={idx} variant="outline">{skill}</Badge>
                                ))}
                              </div>
                            </div>
                            <Button
                              onClick={() => handleImportJob('linkedin', job)}
                              disabled={importMutation.isPending}
                              size="sm"
                            >
                              <DownloadIcon size={16} className="mr-2" />
                              Import
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="indeed" className="space-y-4">
                    {searchMutation.data.results.indeed.map((job: IndeedJob) => (
                      <Card key={job.jobkey}>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold">{job.jobtitle}</h3>
                              <p className="text-gray-600">{job.company} • {job.formattedLocation}</p>
                              <p className="text-sm text-gray-500 mt-2 line-clamp-3">
                                {job.snippet}
                              </p>
                              <div className="flex gap-2 mt-3">
                                <Badge variant="outline">Posted: {job.date}</Badge>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => window.open(job.url, '_blank')}
                                variant="outline"
                                size="sm"
                              >
                                <ExternalLinkIcon size={16} className="mr-2" />
                                View
                              </Button>
                              <Button
                                onClick={() => handleImportJob('indeed', job)}
                                disabled={importMutation.isPending}
                                size="sm"
                              >
                                <DownloadIcon size={16} className="mr-2" />
                                Import
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </TabsContent>

          <TabsContent value="post" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Post Jobs to External Platforms</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Select jobs from your AIM Hi System to post to LinkedIn and Indeed.
                </p>
                <div className="text-sm text-yellow-600 bg-yellow-50 p-4 rounded-lg">
                  ⚠️ Note: Job posting requires valid API credentials for LinkedIn and Indeed. 
                  Configure them in the Setup tab first.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credentials" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {credentialsStatus?.status?.linkedIn ? (
                      <CheckCircleIcon className="text-green-500" size={20} />
                    ) : (
                      <AlertCircleIcon className="text-red-500" size={20} />
                    )}
                    LinkedIn Integration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`p-4 rounded-lg ${credentialsStatus?.status?.linkedIn ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    Status: {credentialsStatus?.status?.linkedIn ? 'Connected' : 'Not Connected'}
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Required Environment Variables:</h4>
                    <ul className="text-sm space-y-1">
                      <li>• LINKEDIN_CLIENT_ID</li>
                      <li>• LINKEDIN_CLIENT_SECRET</li>
                      <li>• LINKEDIN_API_KEY</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Setup Instructions:</h4>
                    <ol className="text-sm space-y-1 list-decimal list-inside">
                      <li>Go to <a href="https://www.linkedin.com/developers/" target="_blank" className="text-blue-600 underline">LinkedIn Developers</a></li>
                      <li>Create a new app and get your credentials</li>
                      <li>Add the environment variables to your system</li>
                      <li>Restart the application</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {credentialsStatus?.status?.indeed ? (
                      <CheckCircleIcon className="text-green-500" size={20} />
                    ) : (
                      <AlertCircleIcon className="text-red-500" size={20} />
                    )}
                    Indeed Integration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`p-4 rounded-lg ${credentialsStatus?.status?.indeed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    Status: {credentialsStatus?.status?.indeed ? 'Connected' : 'Not Connected'}
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Required Environment Variables:</h4>
                    <ul className="text-sm space-y-1">
                      <li>• INDEED_PUBLISHER_ID</li>
                      <li>• INDEED_API_KEY</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Setup Instructions:</h4>
                    <ol className="text-sm space-y-1 list-decimal list-inside">
                      <li>Go to <a href="https://www.indeed.com/publisher" target="_blank" className="text-blue-600 underline">Indeed Publisher</a></li>
                      <li>Sign up for a publisher account</li>
                      <li>Get your Publisher ID and API key</li>
                      <li>Add the environment variables to your system</li>
                      <li>Restart the application</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Integration Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Search & Import</h4>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• Search jobs across LinkedIn and Indeed</li>
                      <li>• Import jobs directly into AIM Hi System</li>
                      <li>• Automatic candidate matching</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Post & Sync</h4>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• Post jobs to external platforms</li>
                      <li>• Synchronize job status</li>
                      <li>• Centralized management</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}