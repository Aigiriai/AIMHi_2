import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import BulkFileUpload from "./bulk-file-upload";

interface JobPostingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function JobPostingModal({ open, onOpenChange, onSuccess }: JobPostingModalProps) {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post New Job</DialogTitle>
        </DialogHeader>

        <BulkFileUpload
          uploadType="jobs"
          onSuccess={() => {
            console.log('🎯 JOB_MODAL: BulkFileUpload onSuccess callback triggered');
            onSuccess?.();
            console.log('🎯 JOB_MODAL: Parent onSuccess callback executed');
          }}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}