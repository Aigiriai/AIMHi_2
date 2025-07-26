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

export default function BulkFileUpload({ uploadType, onSuccess, onClose, onUploadStateChange }: BulkFileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      onUploadStateChange?.(true);
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });

      const endpoint = uploadType === 'jobs' ? '/api/jobs/bulk-upload' : '/api/candidates/bulk-upload';
      const token = localStorage.getItem('authToken');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    },
    onSuccess: (result: UploadResult) => {
      onUploadStateChange?.(false);
      setUploadResult(result);
      if (uploadType === 'jobs') {
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      // Use the custom message from backend if available, otherwise use default
      const message = result.message || `Successfully processed ${result.created} ${uploadType}, ignored ${result.ignored} files`;
      
      toast({
        title: "Upload Complete",
        description: message,
      });
      
      onSuccess?.();
    },
    onError: (error) => {
      onUploadStateChange?.(false);
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
    return ".pdf,.doc,.docx,.txt";
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
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Processing {selectedFiles?.length || 0} files...
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Please keep this window open. Processing may take several minutes.
                </p>
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
            <p className="text-gray-500 mb-4">
              Support for PDF, Word (.doc/.docx), text files, and images (JPG, PNG)
            </p>
            
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