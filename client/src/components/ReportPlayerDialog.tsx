import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Flag, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ReportPlayerDialogProps {
  reportedUserId: string;
  reportedUserName: string;
  gameId?: string;
  trigger?: React.ReactNode;
}

const REPORT_REASONS = [
  { value: "possible_cheating", label: "Possible Cheating", disabled: false },
  { value: "harassment", label: "Harassment (Chat not available yet)", disabled: true },
];

export function ReportPlayerDialog({
  reportedUserId,
  reportedUserName,
  gameId,
  trigger,
}: ReportPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const { toast } = useToast();

  const reportMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/cheat-reports", {
        method: "POST",
        body: JSON.stringify({
          reportedUserId,
          gameId,
          reason,
          details: details.trim() || null,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Report Submitted",
        description: "Thank you for helping keep the community fair. Our team will review the report.",
      });
      setOpen(false);
      setReason("");
      setDetails("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Submit Report",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!reason) {
      toast({
        title: "Select a Reason",
        description: "Please select a reason for your report.",
        variant: "destructive",
      });
      return;
    }
    reportMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-muted-foreground" data-testid="button-report-player">
            <Flag className="h-4 w-4 mr-1" />
            Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Report Player
          </DialogTitle>
          <DialogDescription>
            Report <span className="font-semibold">{reportedUserName}</span> for suspected fair play violations. 
            False reports may result in action against your account.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason for Report</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason" data-testid="select-report-reason">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem 
                    key={r.value} 
                    value={r.value}
                    disabled={r.disabled}
                    className={r.disabled ? "opacity-50" : ""}
                  >
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="details">Additional Details (Optional)</Label>
            <Textarea
              id="details"
              placeholder="Provide any additional context that might help our review..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="min-h-[80px]"
              data-testid="input-report-details"
            />
          </div>
          
          {gameId && (
            <p className="text-sm text-muted-foreground">
              Game ID: <span className="font-mono">{gameId.slice(0, 8)}...</span>
            </p>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-report">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!reason || reportMutation.isPending}
            variant="destructive"
            data-testid="button-submit-report"
          >
            {reportMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Flag className="h-4 w-4 mr-2" />
                Submit Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
