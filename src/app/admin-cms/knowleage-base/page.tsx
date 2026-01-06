"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useUser } from "@/components/auth/UserContext";
import { Button } from "@/components/common/Button";
import { apiRequest } from "@/lib/api";
import MultiSelect from "@/components/common/MultiSelect";
import UserMenu from "@/components/common/UserMenu";

interface FileItem {
  id: string;
  name: string;
  role: string[]; // Change to array for multi-select
  [key: string]: any;
}

const ROLES = ["ict", "com", "pd", "admin"];

export default function AdminCMSPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedRolesMap, setSelectedRolesMap] = useState<{ [fileId: string]: string[] }>({});


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

  // Fetch files with authentication
  useEffect(() => {
    if (!user || user.role !== "admin") return;

    const fetchFiles = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest(`/api/botpress/files`, { withAuth: true });
        setFiles(data.files || data);
        // Initialize selectedRolesMap
        const initialMap: { [fileId: string]: string[] } = {};
        (data.files || data).forEach((file: FileItem) => {
          if (file.tags.roles) {
            initialMap[file.id] = JSON.parse(file.tags.roles);
          }
        });
        setSelectedRolesMap(initialMap);
      } catch (err: any) {
        setError(err.message || "Failed to fetch files");
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, [user]);

  // Handle role update with better error handling
  const handleRoleUpdate = async (file: FileItem) => {
    setUpdating(file.id);
    try {
      await apiRequest(`/api/botpress/files`, {
        method: "PUT",
        body: { id: file.id, data: { tags: { roles: JSON.stringify(selectedRolesMap[file.id]) } } },
        withAuth: true,
      });
      setFiles((prev) =>
        prev.map((f) => f.id === file.id ? { ...f, role: selectedRolesMap[file.id] } : f)
      );
    } catch (err: any) {
      console.log(err)
      // setError(err.message || "Failed to update file role");
    } finally {
      setUpdating(null);
    }
  };

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
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Knowledge Base Files
            </h2>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading files...</p>
          </div>
        ) : error ? (
          <div className="text-center p-4 bg-red-100/50 backdrop-blur-sm rounded-xl border border-red-200/50">
            <p className="text-red-600">{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full max-w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-600 bg-white/50">
                  <th className="py-3 px-4 break-words whitespace-normal">No</th>
                  <th className="py-3 px-4 break-words whitespace-normal">File Name</th>
                  <th className="py-3 px-4 min-w-[12rem] break-words whitespace-normal">Role</th>
                  <th className="py-3 px-4 break-words whitespace-normal">Action</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file, index) => {
                  const selectedRoles = selectedRolesMap[file.id] || [];
                  const roles = file.tags.roles ? JSON.parse(file.tags.roles) : [];
                    const rolesChanged =
                      JSON.stringify(selectedRoles?.sort()) !==
                      JSON.stringify(roles?.sort() ?? []);

                  return (
                    <tr
                      key={file.id}
                      className="bg-white/70 rounded-lg shadow-sm transition hover:bg-white"
                    >
                        <td className="py-3 px-4 font-mono text-sm text-gray-800 break-words whitespace-normal">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4 font-mono text-sm text-gray-800 break-words whitespace-normal">
                          {file.key}
                        </td>
                      <td className="py-3 px-4 min-w-[12rem] break-words whitespace-normal">
                        <MultiSelect
                          options={ROLES}
                          value={selectedRoles}
                            onChange={(v) => {
                              setSelectedRolesMap((prev) => ({ ...prev, [file.id]: v }));
                            }}
                          disabled={updating === file.id}
                        />
                      </td>
                      <td className="py-3 px-4 break-words whitespace-normal">
                        {rolesChanged ? (
                          <Button
                            onClick={() => handleRoleUpdate(file)}
                            disabled={updating === file.id}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1 rounded-md shadow transition"
                          >
                            {updating === file.id ? "Saving..." : "Update"}
                          </Button>
                        ) : (
                          <span className="text-green-500 text-sm">✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
    </div>
  );
} 