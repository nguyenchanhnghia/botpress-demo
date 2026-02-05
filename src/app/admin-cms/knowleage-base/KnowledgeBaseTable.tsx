"use client";

import type { FileItem } from "./types";
import { ButtonOutline } from "@/components/common/Button";

type KnowledgeBaseTableProps = {
  files: FileItem[];
  getFileName: (file: FileItem) => string;
  onEdit: (file: FileItem) => void;
};

export default function KnowledgeBaseTable({
  files,
  getFileName,
  onEdit,
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
                <ButtonOutline onClick={() => onEdit(file)} className="px-4">
                  Edit
                </ButtonOutline>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
