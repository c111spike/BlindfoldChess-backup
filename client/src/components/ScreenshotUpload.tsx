import { useState, useRef } from "react";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2 } from "lucide-react";

interface ScreenshotUploadProps {
  onUploadComplete: (objectPath: string) => void;
  onRemove?: () => void;
  onUploadError?: (error: string) => void;
  disabled?: boolean;
}

export function ScreenshotUpload({
  onUploadComplete,
  onRemove,
  onUploadError,
  disabled = false,
}: ScreenshotUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: "image/webp" as const,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (error) {
      console.error("Compression failed, using original:", error);
      return file;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onUploadError?.("Please select an image file");
      return;
    }

    setIsUploading(true);

    try {
      const compressedFile = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressedFile);
      setPreview(previewUrl);

      const urlResponse = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name.replace(/\.[^.]+$/, ".webp"),
          size: compressedFile.size,
          contentType: "image/webp",
        }),
      });

      if (!urlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await urlResponse.json();

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: compressedFile,
        headers: { "Content-Type": "image/webp" },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      setUploadedPath(objectPath);
      onUploadComplete(objectPath);
    } catch (error) {
      console.error("Upload error:", error);
      onUploadError?.(error instanceof Error ? error.message : "Upload failed");
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setUploadedPath(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onRemove?.();
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
        data-testid="input-screenshot"
      />

      {!preview ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="w-full"
          data-testid="button-add-screenshot"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4 mr-2" />
              Add Screenshot (Optional)
            </>
          )}
        </Button>
      ) : (
        <div className="relative">
          <img
            src={preview}
            alt="Screenshot preview"
            className="w-full max-h-40 object-contain rounded-lg border"
            data-testid="img-screenshot-preview"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={handleRemove}
            disabled={isUploading}
            data-testid="button-remove-screenshot"
          >
            <X className="h-3 w-3" />
          </Button>
          {uploadedPath && (
            <p className="text-xs text-muted-foreground mt-1">Screenshot attached</p>
          )}
        </div>
      )}
    </div>
  );
}
