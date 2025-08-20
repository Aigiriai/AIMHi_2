import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { UploadIcon, FileIcon, FolderIcon, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface BulkFileUploadProps {
  uploadType: 'jobs' | 'candidates';
  onSuccess?: () => void;
  onClose?: () => void;
  onUploadStateChange?: (isUploading: boolean) => void;
}

interface UploadResult {
  message: string;
  created: number;
  ignored: number;
  errors: number;
  details: {
    createdJobs?: any[];
    createdCandidates?: any[];
    ignoredFiles: string[];
    errors: Array<{ filename: string; error: string }>;
  };
}

interface ProgressData {
  stage: 'starting' | 'extracting' | 'creating' | 'complete' | 'error';
  message: string;
  progress: number;
  total: number;
  currentFile?: string;
  candidateName?: string;
  results?: UploadResult;
  error?: boolean;
}

export default function BulkFileUpload({ uploadType, onSuccess, onClose, onUploadStateChange }: BulkFileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      onUploadStateChange?.(true);
      setProgressData(null);
      
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });

      // Use progress endpoint for candidates, regular endpoint for jobs
      const endpoint = uploadType === 'jobs' ? '/api/jobs/bulk-upload' : '/api/candidates/bulk-upload-progress';
      const token = localStorage.getItem('authToken');
      
      if (uploadType === 'candidates') {
        // Use Server-Sent Events for progress tracking
        return new Promise((resolve, reject) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 10 * 60 * 1000); // 10 minute timeout
          
          fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData,
            signal: controller.signal,
          })
          .then(response => {
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              throw new Error('Upload failed');
            }
            
            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error('No response reader available');
            }
            
            const decoder = new TextDecoder();
            let buffer = '';
            
            function readStream(): Promise<void> {
              return reader!.read().then(({ done, value }) => {
                if (done) {
                  return;
                }
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.slice(6)) as ProgressData;
                      setProgressData(data);
                      
                      if (data.stage === 'complete' && data.results) {
                        resolve(data.results);
                        return;
                      } else if (data.stage === 'error') {
                        reject(new Error(data.message || 'Upload failed'));
                        return;
                      }
                    } catch (parseError) {
                      console.warn('Failed to parse SSE data:', line);
                    }
                  }
                }
                
                return readStream();
              });
            }
            
            return readStream();
          })
          .catch(error => {
            clearTimeout(timeoutId);
            if ((error as Error).name === 'AbortError') {
              reject(new Error('Upload timeout: The upload took too long to complete. Please try with fewer files or check your internet connection.'));
            } else {
              reject(error);
            }
          });
        });
      } else {
        // Regular upload for jobs (no progress tracking yet)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 10 * 60 * 1000);
        
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error('Upload failed');
          }

          return response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          if ((error as Error).name === 'AbortError') {
            throw new Error('Upload timeout: The upload took too long to complete. Please try with fewer files or check your internet connection.');
          }
          throw error;
        }
      }
    },
    onSuccess: (result: UploadResult) => {
      console.log('✅ BULK_UPLOAD: Upload mutation successful, starting post-processing...', { result });
      onUploadStateChange?.(false);
      setUploadResult(result);
      setProgressData(null); // Clear progress data
      
      console.log('🔄 CACHE_INVALIDATION: Starting cache invalidation after successful upload', { uploadType, result });
      
      // Aggressively invalidate and refetch data after upload
      if (uploadType === 'jobs') {
        console.log('🔄 CACHE_INVALIDATION: Invalidating jobs queries...');
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        console.log('🔄 CACHE_INVALIDATION: Forcing immediate refetch of jobs...');
        queryClient.refetchQueries({ queryKey: ["/api/jobs"] }); // Force immediate refetch
      } else {
        console.log('🔄 CACHE_INVALIDATION: Invalidating candidates queries...');
        queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
        console.log('🔄 CACHE_INVALIDATION: Forcing immediate refetch of candidates...');
        queryClient.refetchQueries({ queryKey: ["/api/candidates"] }); // Force immediate refetch
      }
      console.log('🔄 CACHE_INVALIDATION: Invalidating stats queries...');
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      console.log('🔄 CACHE_INVALIDATION: Forcing immediate refetch of stats...');
      queryClient.refetchQueries({ queryKey: ["/api/stats"] }); // Force immediate refetch
      
      console.log('✅ CACHE_INVALIDATION: All cache invalidation and refetch operations completed');
      
      // Now call the external onSuccess callback
      console.log('🎯 BULK_UPLOAD: Calling external onSuccess callback...');
      onSuccess?.();
      console.log('✅ BULK_UPLOAD: External onSuccess callback completed');
      
      // Use the custom message from backend if available, otherwise use default
      const message = result.message || `Successfully processed ${result.created} ${uploadType}, ignored ${result.ignored} files`;
      
      toast({
        title: "Upload Complete",
        description: message,
      });
      
      onSuccess?.();
    },
    onError: (error: any) => {
      onUploadStateChange?.(false);
      setProgressData(null); // Clear progress data on error
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
      });
    },
  });

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

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
    }
  };

  const handleUpload = () => {
    if (selectedFiles) {
      uploadMutation.mutate(selectedFiles);
    }
  };

  const getAcceptedTypes = () => {
    return ".doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp";
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return <FileIcon className="h-4 w-4 text-red-500" />;
      case 'doc':
      case 'docx':
        return <FileIcon className="h-4 w-4 text-blue-500" />;
      case 'txt':
        return <FileIcon className="h-4 w-4 text-gray-500" />;
      default:
        return <FileIcon className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {uploadMutation.isPending && (
        <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <div className="flex-1">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  {progressData ? progressData.message : `Processing ${selectedFiles?.length || 0} files...`}
                </p>
                {progressData && (
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between text-sm text-blue-700 dark:text-blue-300">
                      <span>
                        {progressData.stage === 'extracting' ? 'Extracting text from documents' : 
                         progressData.stage === 'creating' ? 'Creating candidate profiles' : 
                         progressData.stage === 'complete' ? 'Complete!' : 'Processing...'}
                      </span>
                      <span>{progressData.progress}/{progressData.total}</span>
                    </div>
                    <Progress 
                      value={(progressData.progress / progressData.total) * 100} 
                      className="w-full h-2"
                    />
                    {progressData.currentFile && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 truncate">
                        {progressData.candidateName ? 
                          `Creating profile for: ${progressData.candidateName}` : 
                          `Processing: ${progressData.currentFile}`
                        }
                      </p>
                    )}
                  </div>
                )}
                {!progressData && (
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Large uploads may take up to 10 minutes.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>
            {uploadType === 'jobs' ? 'Upload Job Descriptions' : 'Upload Resumes'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <UploadIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Drop files here or click to browse
            </h3>
            <div className="mb-4">
              <p className="text-gray-700 font-medium mb-2">
                ✅ Supported Formats:
              </p>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• Microsoft Word (.docx)</p>
                <p>• Plain Text (.txt)</p>
                <p>• Image files (.jpg, .jpeg, .png, .gif, .bmp, .webp) - with OCR</p>
                <p>• Legacy Word (.doc) - limited support</p>
              </div>
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700 font-medium">
                  ❌ PDF files are NOT supported in this environment
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Please convert PDFs to .docx or .txt format before uploading
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileIcon className="mr-2 h-4 w-4" />
                Select Files
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => directoryInputRef.current?.click()}
              >
                <FolderIcon className="mr-2 h-4 w-4" />
                Select Folder
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={getAcceptedTypes()}
              onChange={handleFileInput}
              className="hidden"
            />
            
            <input
              ref={directoryInputRef}
              type="file"
              multiple
              accept={getAcceptedTypes()}
              onChange={handleFileInput}
              className="hidden"
              {...({ webkitdirectory: "true" } as any)}
            />
          </div>

          {selectedFiles && selectedFiles.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Selected Files ({selectedFiles.length})</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {Array.from(selectedFiles).slice(0, 10).map((file, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm">
                    {getFileIcon(file.name)}
                    <span className="flex-1 truncate">{file.name}</span>
                    <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
                  </div>
                ))}
                {selectedFiles.length > 10 && (
                  <p className="text-sm text-gray-500">
                    ... and {selectedFiles.length - 10} more files
                  </p>
                )}
              </div>
              
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                className="w-full"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Progress value={50} className="mr-2 w-4 h-4" />
                    Processing...
                  </>
                ) : (
                  <>
                    <UploadIcon className="mr-2 h-4 w-4" />
                    Upload {selectedFiles.length} Files
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {uploadResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
              Upload Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">{uploadResult.created}</div>
                <div className="text-sm text-gray-500">Created</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-yellow-600">{uploadResult.ignored}</div>
                <div className="text-sm text-gray-500">Ignored</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-red-600">{uploadResult.errors}</div>
                <div className="text-sm text-gray-500">Errors</div>
              </div>
            </div>

            {uploadResult.details.ignoredFiles.length > 0 && (
              <div className="space-y-2">
                <h5 className="font-medium flex items-center">
                  <AlertCircle className="mr-2 h-4 w-4 text-yellow-500" />
                  Ignored Files
                </h5>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {uploadResult.details.ignoredFiles.map((filename, index) => (
                    <div key={index} className="text-sm text-gray-600 pl-6">
                      {filename}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadResult.details.errors.length > 0 && (
              <div className="space-y-2">
                <h5 className="font-medium flex items-center">
                  <XCircle className="mr-2 h-4 w-4 text-red-500" />
                  Errors
                </h5>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {uploadResult.details.errors.map((error, index) => (
                    <div key={index} className="text-sm">
                      <span className="font-medium">{error.filename}:</span>
                      <span className="text-red-600 ml-1">{error.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={onClose} className="w-full">
              Done
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}