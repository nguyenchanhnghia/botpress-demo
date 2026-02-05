"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { Button, ButtonOutline } from "@/components/common/Button";
import type { FileItem } from "./types";

type EditFileModalProps = {
  file: FileItem;
  getFileName: (file: FileItem) => string;
  onClose: () => void;
  onUploaded: () => void;
};

const isAllowedFile = (fileName: string) => {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".docx");
};

export default function EditFileModal({
  file,
  getFileName,
  onClose,
  onUploaded,
}: EditFileModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = e.target.files?.[0] || null;
    if (!nextFile) {
      setSelectedFile(null);
      return;
    }
    if (!isAllowedFile(nextFile.name)) {
      setUploadError("Only .md and .docx files are allowed.");
      setSelectedFile(null);
      return;
    }
    setUploadError(null);
    setSelectedFile(nextFile);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Please choose a file.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      let fileContentBase64 = "";
      if (selectedFile.name.toLowerCase().endsWith(".md")) {
        const text = await selectedFile.text();
        fileContentBase64 = btoa(unescape(encodeURIComponent(text)));
      } else {
        const buf = await selectedFile.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        fileContentBase64 = btoa(binary);
      }

      await apiRequest(`/api/botpress/files`, {
        method: "PUT",
        withAuth: true,
        body: {
          id: file.id,
          data: {
            fileName: selectedFile.name,
            contentType:
              selectedFile.type ||
              (selectedFile.name.toLowerCase().endsWith(".md")
                ? "text/markdown"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            fileContentBase64,
          },
        },
      });

      setSelectedFile(null);
      setUploadError(null);
      onUploaded();
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => !uploading && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white/95 p-6 shadow-2xl border border-white/60"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900">Edit file</h3>
        <p className="text-xs text-gray-500 mt-1 break-words">
          {getFileName(file)}
        </p>

        <div className="mt-4">
          <p className="text-xs text-gray-600">
            Replace the existing file. Supported types:{" "}
            <span className="font-semibold">.md</span> and{" "}
            <span className="font-semibold">.docx</span>.
          </p>

          <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white/80 px-4 py-6 text-center text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition">
            <input
              type="file"
              accept=".md,.docx"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
            />
            <div>
              <div className="text-sm font-semibold">Click to choose a file</div>
              <div className="text-xs text-gray-500 mt-1">
                or drag &amp; drop here
              </div>
            </div>
          </label>

          {selectedFile && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
              <div className="font-semibold break-words">
                {selectedFile.name}
              </div>
              <div className="text-gray-500 mt-1">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          )}

          {uploadError && (
            <div className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {uploadError}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <ButtonOutline onClick={onClose} disabled={uploading} className="px-4">
            Cancel
          </ButtonOutline>
          <Button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="px-4 py-2"
          >
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>
    </div>
  );
}
