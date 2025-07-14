import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";

interface SimpleInterviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SimpleInterviewModal({ open, onOpenChange }: SimpleInterviewModalProps) {
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");

  const handleSchedule = () => {
    alert(`Interview scheduled for ${interviewDate} at ${interviewTime}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Interview
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Interview Date</label>
            <Input
              type="date"
              value={interviewDate}
              onChange={(e) => setInterviewDate(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Interview Time</label>
            <Input
              type="time"
              value={interviewTime}
              onChange={(e) => setInterviewTime(e.target.value)}
            />
          </div>
          
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSchedule} disabled={!interviewDate || !interviewTime}>
              Schedule Interview
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}