'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/common/Button';
import { useUser } from '@/components/auth/UserContext';

interface ImageItem {
  key: string;
  url?: string; // Presigned URL
  contentType: string;
  uploadedAt?: string;
}

export default function AdminImagesPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin-only access check
  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.role !== 'admin') {
      setError('Access denied. Admin privileges required.');
    }
  }, [user, userLoading, router]);

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size exceeds 10MB limit');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiRequest<{
        success: boolean;
        image: { key: string; url: string; contentType: string };
      }>('/api/admin/images/upload', {
        method: 'POST',
        body: formData,
        withAuth: true,
      });

      // Add to images list
      setImages((prev) => [
        {
          key: response.image.key,
          contentType: response.image.contentType,
          uploadedAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  // Get presigned URL for image preview
  const getImagePreview = async (key: string) => {
    try {
      const response = await apiRequest<{
        success: boolean;
        url: string;
        key: string;
      }>('/api/admin/images/presigned-url', {
        method: 'POST',
        body: { key },
        withAuth: true,
      });

      setPreviewUrl(response.url);
      setPreviewKey(key);
    } catch (err: any) {
      setError(err.message || 'Failed to load image preview');
    }
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Show loading while user is being determined
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Show error if access denied
  if (error && error.includes('Access denied')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white/80 rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => router.push('/botChat')}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
      <div className="max-w-6xl mx-auto bg-white/80 rounded-2xl shadow-xl p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Admin CMS - Image Management
          </h1>
          <div className="text-sm text-gray-600">
            Logged in as: <span className="font-semibold">{user?.username}</span> (Admin)
          </div>
        </div>

        {error && !error.includes('Access denied') && (
          <div className="mb-4 p-4 bg-red-100/50 backdrop-blur-sm rounded-xl border border-red-200/50">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Upload Section */}
        <div className="mb-8 p-6 bg-white/50 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-500 transition">
          <div className="text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className="cursor-pointer inline-block"
            >
              <div className="flex flex-col items-center">
                <svg
                  className="w-12 h-12 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span className="text-gray-600 mb-2">
                  {uploading ? 'Uploading...' : 'Click to upload image'}
                </span>
                <span className="text-sm text-gray-400">
                  PNG, JPG, GIF, WEBP up to 10MB
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Images Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Uploaded Images</h2>
          {images.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No images uploaded yet.</p>
              <p className="text-sm mt-2">Upload your first image using the upload area above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <div
                  key={image.key || index}
                  className="relative group bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
                >
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    {image.url ? (
                      <img
                        src={image.url}
                        alt={image.key}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <svg
                          className="w-12 h-12 text-gray-400 mx-auto mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <p className="text-xs text-gray-500">No preview</p>
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      onClick={() => getImagePreview(image.key)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded"
                    >
                      Preview
                    </Button>
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-gray-600 truncate" title={image.key}>
                      {image.key.split('/').pop()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {previewUrl && (
          <div
            className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setPreviewUrl(null);
              setPreviewKey(null);
            }}
          >
            <div
              className="max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">
                  Image Preview: {previewKey?.split('/').pop()}
                </h3>
                <button
                  onClick={() => {
                    setPreviewUrl(null);
                    setPreviewKey(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full h-auto mx-auto"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

