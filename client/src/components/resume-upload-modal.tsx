import { useState } from "react";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import BulkFileUpload from "./bulk-file-upload";

interface ResumeUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function ResumeUploadModal({ open, onOpenChange, onSuccess }: ResumeUploadModalProps) {
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Resume</DialogTitle>
          </DialogHeader>
          
          <BulkFileUpload
            uploadType="candidates"
            onSuccess={() => {
              onSuccess?.();
            }}
            onClose={() => onOpenChange(false)}
            onUploadStateChange={setIsBulkUploading}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}