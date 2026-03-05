"use client";

import type { FileItem } from "./types";

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const DeleteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </svg>
);

type KnowledgeBaseTableProps = {
  files: FileItem[];
  getFileName: (file: FileItem) => string;
  onEdit: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
};

export default function KnowledgeBaseTable({
  files,
  getFileName,
  onEdit,
  onDelete,
}: KnowledgeBaseTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full max-w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-600 bg-white/50">
            <th className="py-3 px-4 break-words whitespace-normal">No</th>
            <th className="py-3 px-4 break-words whitespace-normal">File Name</th>
            <th className="py-3 px-4 break-words whitespace-normal">Action</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file, index) => (
            <tr
              key={file.id}
              className="bg-white/70 rounded-lg shadow-sm transition hover:bg-white"
            >
              <td className="py-3 px-4 font-mono text-sm text-gray-800 break-words whitespace-normal">
                {index + 1}
              </td>
              <td className="py-3 px-4 font-mono text-sm text-gray-800 break-words whitespace-normal">
                {getFileName(file)}
              </td>
              <td className="py-3 px-4 break-words whitespace-normal">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(file)}
                    aria-label="Edit"
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition"
                  >
                    <EditIcon />
                  </button>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(file)}
                      aria-label="Delete"
                      className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-rose-600 transition"
                    >
                      <DeleteIcon />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
