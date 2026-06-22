import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDocuments,
  useDeleteDocument,
  getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import { Upload, FileText, Trash2, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ready: { label: "Ready", cls: "text-green-400 bg-green-400/10" },
    processing: { label: "Processing", cls: "text-yellow-400 bg-yellow-400/10" },
    error: { label: "Error", cls: "text-red-400 bg-red-400/10" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "text-muted-foreground bg-muted" };
  return (
    <span className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium", cls)}>
      {label}
    </span>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Documents() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: documents, isLoading } = useListDocuments();
  const deleteMutation = useDeleteDocument();

  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail ?? `HTTP ${res.status}`);
        }
        const doc = await res.json();
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        toast({ title: "Document uploaded", description: `${doc.name} is being processed.` });
      } catch (err: any) {
        toast({
          title: "Upload failed",
          description: err?.message ?? "Unknown error",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [queryClient, toast]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(uploadFile);
    e.target.value = "";
  };

  const handleDelete = (id: string, name: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
          toast({ title: "Document deleted", description: `${name} has been removed.` });
        },
        onError: (err: any) => {
          toast({
            title: "Delete failed",
            description: err?.data?.error ?? "Unknown error",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload clinical and regulatory documents for AI-powered analysis
        </p>
      </div>

      {/* Upload zone */}
      <div
        data-testid="upload-dropzone"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors mb-8",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-card"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          multiple
          className="hidden"
          onChange={handleFileChange}
          data-testid="input-file"
        />
        <Upload className={cn("w-8 h-8 mx-auto mb-3", dragOver ? "text-primary" : "text-muted-foreground")} />
        <div className="text-sm font-medium text-foreground mb-1">
          {isUploading ? "Uploading..." : "Drop files here or click to upload"}
        </div>
        <div className="text-xs text-muted-foreground">PDF, DOCX, TXT — up to 50 MB each</div>
        {isUploading && (
          <div className="mt-3">
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        )}
      </div>

      {/* Document list */}
      <div className="bg-card border border-border rounded">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Uploaded Documents</span>
          <span className="text-xs text-muted-foreground">{documents?.length ?? 0} files</span>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading documents...</div>
        ) : !documents?.length ? (
          <div className="p-12 text-center">
            <File className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <div className="text-sm text-muted-foreground">No documents uploaded yet.</div>
            <div className="text-xs text-muted-foreground mt-1">
              Upload FDA guidance, clinical trial protocols, ICF documents, or SDTM files.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {documents.map((doc) => (
              <div
                key={doc.id}
                data-testid={`document-row-${doc.id}`}
                className="px-5 py-4 flex items-center gap-4"
              >
                <div className="w-9 h-9 rounded bg-muted flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{doc.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {doc.file_type} · {formatBytes(doc.file_size)}
                    {doc.pages != null && ` · ${doc.pages} pages`}
                    {doc.chunk_count > 0 && ` · ${doc.chunk_count} chunks`}
                    {" · "}{formatDate(doc.uploaded_at)}
                  </div>
                </div>
                <StatusBadge status={doc.status} />
                <button
                  data-testid={`button-delete-${doc.id}`}
                  onClick={() => handleDelete(doc.id, doc.name)}
                  disabled={deleteMutation.isPending}
                  className="p-2 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Supported types info */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { type: "PDF", desc: "FDA guidance, clinical trial protocols, ICF documents" },
          { type: "DOCX", desc: "Word documents, regulatory submissions, SDTM documentation" },
          { type: "TXT", desc: "Plain text files, extracted content, raw regulatory text" },
        ].map(({ type, desc }) => (
          <div key={type} className="bg-card border border-border rounded p-3">
            <div className="text-xs font-mono text-primary mb-1">.{type.toLowerCase()}</div>
            <div className="text-[11px] text-muted-foreground">{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
