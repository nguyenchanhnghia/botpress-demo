"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { Button, ButtonOutline } from "@/components/common/Button";
import ConfirmModal from "@/components/common/ConfirmModal";
import type { KnowledgeBaseItem } from "./types";

type UploadFileModalProps = {
  onClose: () => void;
  onUploaded: () => void;
};

const allowedExtensions = [".md", ".docx"];
const allowedMimeTypes = [
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const isAllowedFile = (file: File) => {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  const hasAllowedExtension = allowedExtensions.some((ext) => name.endsWith(ext));
  const hasAllowedMime = allowedMimeTypes.includes(type);
  // Prefer MIME when provided; fallback to extension for browsers that omit type.
  return hasAllowedMime || (type === "" && hasAllowedExtension) || hasAllowedExtension;
};

export default function UploadFileModal({ onClose, onUploaded }: UploadFileModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedKbId, setSelectedKbId] = useState("");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
  const [knowledgeBaseLoading, setKnowledgeBaseLoading] = useState(true);
  const [knowledgeBaseError, setKnowledgeBaseError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const fetchKnowledgeBases = async () => {
      try {
        setKnowledgeBaseError(null);
        setKnowledgeBaseLoading(true);
        const data = await apiRequest(`/api/botpress/knowledge-bases`, {
          withAuth: true,
        });
        if (!isActive) return;
        const items: KnowledgeBaseItem[] = (data?.knowledgeBases || []) as any;
        setKnowledgeBases(items);
      } catch (err: any) {
        if (!isActive) return;
        setKnowledgeBaseError(err?.message || "Failed to load knowledge bases.");
      } finally {
        if (isActive) setKnowledgeBaseLoading(false);
      }
    };
    fetchKnowledgeBases();
    return () => {
      isActive = false;
    };
  }, []);

  const selectedKbName = useMemo(() => {
    const kb = knowledgeBases.find((item) => item.id === selectedKbId);
    return kb?.name || "";
  }, [knowledgeBases, selectedKbId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = e.target.files?.[0] || null;
    if (!nextFile) {
      setSelectedFile(null);
      return;
    }
    if (!isAllowedFile(nextFile)) {
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
    if (!selectedKbId) {
      setUploadError("Please select a Knowledge Base.");
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile || !selectedKbId) return;

    setUploading(true);
    setUploadError(null);
    try {
      const key = selectedFile.name;
      const contentType =
        selectedFile.type ||
        (selectedFile.name.toLowerCase().endsWith(".md")
          ? "text/markdown"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

      const upsertResponse = await apiRequest(`/api/botpress/files`, {
        method: "PUT",
        withAuth: true,
        body: {
          mode: "upsert",
          payload: {
            key,
            size: selectedFile.size,
            index: true,
            tags: {
              source: "knowledge-base",
              kbId: selectedKbId,
              ...(title.trim() ? { title: title.trim() } : {}),
            },
            contentType,
          },
        },
      });

      const uploadUrl =
        upsertResponse?.file?.uploadUrl ||
        upsertResponse?.file?.uploadURL ||
        upsertResponse?.uploadUrl ||
        upsertResponse?.uploadURL;

      if (!uploadUrl) {
        throw new Error("Upload URL not returned from server.");
      }

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        body: selectedFile,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed (${uploadRes.status})`);
      }

      setSelectedFile(null);
      setSelectedKbId("");
      setTitle("");
      setUploadError(null);
      setConfirmOpen(false);
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
        <h3 className="text-lg font-semibold text-gray-900">Upload file</h3>
        <p className="text-xs text-gray-500 mt-1">
          Choose a Knowledge Base and upload a{" "}
          <span className="font-semibold">.md</span> or{" "}
          <span className="font-semibold">.docx</span> file.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Knowledge Base
            </label>
            <select
              value={selectedKbId}
              onChange={(e) => setSelectedKbId(e.target.value)}
              disabled={uploading || knowledgeBaseLoading}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            >
              {knowledgeBaseLoading ? (
                <option value="">Loading knowledge bases...</option>
              ) : (
                <>
                  <option value="">Select a Knowledge Base</option>
                  {knowledgeBases.map((kb) => (
                    <option key={kb.id} value={kb.id}>
                      {kb.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
              placeholder="Display title for the file"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            />
          </div>

          <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white/80 px-4 py-6 text-center text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition">
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
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
              <div className="font-semibold break-words">{selectedFile.name}</div>
              <div className="text-gray-500 mt-1">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          )}

          {knowledgeBaseError && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {knowledgeBaseError}
            </div>
          )}
          {uploadError && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
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
            disabled={uploading || !selectedFile || !selectedKbId}
            className="px-4 py-2"
          >
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>

        <ConfirmModal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleConfirmUpload}
          title="Confirm upload"
          message={
            <>
              Upload <span className="font-semibold">{selectedFile?.name}</span>
              {selectedKbName ? (
                <>
                  {" "}to <span className="font-semibold">{selectedKbName}</span>
                </>
              ) : null}
            </>
          }
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          loading={uploading}
        />
      </div>
    </div>
  );
}
