import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";

type LegalTextDialogProps = {
  activePath: string | null;
  content: string | null;
  missingMessage: string;
  onOpenChange: (open: boolean) => void;
};

export const LegalDocumentTextDialog = ({
  activePath,
  content,
  missingMessage,
  onOpenChange,
}: LegalTextDialogProps) => (
  <Dialog open={Boolean(activePath)} onOpenChange={onOpenChange}>
    <DialogContent className="grid-rows-[auto_minmax(0,1fr)] max-h-[85vh] max-w-4xl">
      <DialogCloseButton label="Close document" />
      <DialogHeader>
        <DialogTitle className="pr-8">{activePath ?? "Document"}</DialogTitle>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-4">
        <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-6 text-foreground">
          {content ?? missingMessage}
        </pre>
      </div>
    </DialogContent>
  </Dialog>
);
