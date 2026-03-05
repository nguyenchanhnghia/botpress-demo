"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useUser } from "@/components/auth/UserContext";
import UserMenu from "@/components/common/UserMenu";
import ConfirmModal from "@/components/common/ConfirmModal";
import { Button, ButtonOutline } from "@/components/common/Button";
import KnowledgeBaseTable from "./KnowledgeBaseTable";
import EditFileModal from "./EditFileModal";
import UploadFileModal from "./UploadFileModal";
import { useKnowledgeBaseFiles } from "./useKnowledgeBaseFiles";
import { apiRequest } from "@/lib/api";
import type { FileItem } from "./types";

export default function AdminCMSPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [editFile, setEditFile] = useState<FileItem | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteFile, setDeleteFile] = useState<FileItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const {
    filteredFiles,
    loading,
    error: fetchError,
    nextToken,
    prevTokens,
    getFileName,
    fetchFiles,
    handleNextPage,
    handlePrevPage,
    searchTerm,
    setSearchTerm,
    searching,
    searchResults,
    searchError,
    searchByName,
    clearSearch,
    isSearchActive,
  } = useKnowledgeBaseFiles(user?.email, !!user && user.role === "admin");


  // Simple admin-only role check
  useEffect(() => {
    if (userLoading) return; // Wait for user to load

    if (!user) {
      router.replace("/login");
      return;
    }

    // Only admin can access this page
    if (user.role !== "admin") {
      setError("Access denied. Admin privileges required.");
      return;
    }
  }, [user, userLoading, router]);

  const handleEditClick = (file: FileItem) => {
    setEditFile(file);
  };

  const handleCloseModal = () => {
    setEditFile(null);
  };

  const handleDeleteClick = (file: FileItem) => {
    setDeleteFile(file);
  };

  const handleConfirmDelete = async () => {
    if (!deleteFile) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/botpress/files/${deleteFile.id}`, {
        method: "DELETE",
        withAuth: true,
      });
      setDeleteFile(null);
      fetchFiles();
    } catch (err: any) {
      setError(err?.message || "Failed to delete file");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (fetchError) setError(fetchError);
  }, [fetchError]);

  useEffect(() => {
    if (searchError) setError(searchError);
  }, [searchError]);

  const displayFiles = isSearchActive
    ? searchResults
    : filteredFiles;

  // Show loading while user is being determined
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Show error if access denied
  if (error && error.includes("Access denied")) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white/80 rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => router.push("/botChat")}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header - shared style with admin users page */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-white/20 p-3 sm:p-4">
        <div className="max-w-6xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Avatar + title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
              <Image
                src="https://chatbotcdn.socialenable.co/vietjet-air/assets/images/amy-full-body.png"
                alt="TVJ Assistant"
                width={40}
                height={40}
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-red-600 to-yellow-600 bg-clip-text text-transparent truncate">
                TVJ Internal Assistant
              </h1>
              <p className="text-[11px] sm:text-xs text-gray-500">
                Admin CMS · Knowledge Base
              </p>
            </div>
          </div>

          {/* Right: user dropdown navigation */}
          <div className="flex w-full sm:w-auto items-center justify-stretch sm:justify-end gap-2">
            <UserMenu
              items={[
                { label: "Chat", href: "/botChat" },
                { label: "Users", href: "/admin-cms/users", adminOnly: true },
                { label: "Knowledge Base", href: "/admin-cms/knowleage-base", adminOnly: true },
                { label: "Images", href: "/admin-cms/images", adminOnly: true },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto bg-white/80 rounded-2xl shadow-xl p-4 sm:p-8">
          <div className="flex justify-end items-center mb-6">
            <div>
              <Button
                onClick={() => setUploadOpen(true)}
                disabled={loading || searching}
                className="px-4"
              >
                Upload
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative min-w-100">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by filename..."
                  className="w-full rounded-full border border-gray-200 bg-white pl-4 pr-0 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                />
                <button
                  type="button"
                  onClick={clearSearch}
                  disabled={loading || searching || !searchTerm.trim()}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-[14px] font-semibold text-gray-700 bg-transparent hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ×
                </button>
              </div>
              <ButtonOutline
                onClick={() => searchByName(searchTerm)}
                disabled={loading || searching || !searchTerm.trim()}
                className="px-4"
              >
                {searching ? "..." : "Search"}
              </ButtonOutline>
            </div>
            <div className="flex items-center gap-2">
              <ButtonOutline
                onClick={handlePrevPage}
                disabled={loading || searching || prevTokens.length === 0 || isSearchActive}
                className="px-4"
              >
                Prev
              </ButtonOutline>
              <ButtonOutline
                onClick={handleNextPage}
                disabled={loading || searching || !nextToken || isSearchActive}
                className="px-4"
              >
                Next
              </ButtonOutline>
            </div>
          </div>
          {loading || searching ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{searching ? "Searching files..." : "Loading files..."}</p>
            </div>
          ) : error ? (
            <div className="text-center p-4 bg-red-100/50 backdrop-blur-sm rounded-xl border border-red-200/50">
              <p className="text-red-600">{error}</p>
            </div>
          ) : (
            <KnowledgeBaseTable
              files={displayFiles}
              getFileName={getFileName}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />
          )}
        </div>
      </div>
      {editFile && (
        <EditFileModal
          file={editFile}
          getFileName={getFileName}
          onClose={handleCloseModal}
          onUploaded={() => {
            handleCloseModal();
            fetchFiles();
          }}
        />
      )}
      {uploadOpen && (
        <UploadFileModal
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            fetchFiles();
          }}
        />
      )}
      <ConfirmModal
        open={!!deleteFile}
        onClose={() => setDeleteFile(null)}
        onConfirm={handleConfirmDelete}
        title="Delete file"
        message={
          deleteFile ? (
            <>
              Delete <span className="font-semibold">{getFileName(deleteFile)}</span>? This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleting}
        variant="danger"
      />
    </div>
  );
} 