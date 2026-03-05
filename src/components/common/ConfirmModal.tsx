"use client";

import { Button, ButtonOutline } from "@/components/common/Button";

export type ConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: "default" | "danger";
};

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  variant = "default",
}: ConfirmModalProps) {
  if (!open) return null;

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-base font-semibold text-gray-900">{title}</h4>
        <div className="text-xs text-gray-600 mt-2 break-words">{message}</div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <ButtonOutline
            onClick={onClose}
            disabled={loading}
            className="px-3"
          >
            {cancelLabel}
          </ButtonOutline>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={`px-3 py-2 ${variant === "danger" ? "!from-rose-600 !to-rose-700 hover:!from-rose-700 hover:!to-rose-800" : ""}`}
          >
            {loading ? "..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
