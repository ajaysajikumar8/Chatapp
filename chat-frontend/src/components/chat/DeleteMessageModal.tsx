import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, X } from 'lucide-react';

interface DeleteMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: 'me' | 'everyone') => void;
  canDeleteEveryone: boolean;
}

export const DeleteMessageModal: React.FC<DeleteMessageModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  canDeleteEveryone,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.25 }}
            className="relative w-full max-w-sm bg-bg-surface border border-border-light rounded-2xl shadow-2xl overflow-hidden p-6 z-10 flex flex-col items-center text-center"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full text-text-muted hover:text-text-base hover:bg-bg-surface-hover transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            {/* Danger Icon */}
            <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-4">
              <Trash2 size={22} />
            </div>

            <h3 className="text-lg font-semibold text-text-base mb-2">Delete message?</h3>
            <p className="text-sm text-text-subtle mb-6 leading-relaxed">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>

            <div className="w-full flex flex-col gap-2.5">
              {canDeleteEveryone && (
                <button
                  type="button"
                  onClick={() => {
                    onConfirm('everyone');
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 bg-danger hover:bg-danger-hover text-white font-semibold rounded-xl text-sm transition-colors shadow-md shadow-danger/10 flex items-center justify-center gap-2"
                >
                  <span>Delete for Everyone</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onConfirm('me');
                  onClose();
                }}
                className={`w-full py-2.5 px-4 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 ${
                  canDeleteEveryone
                    ? 'bg-bg-surface-hover hover:bg-bg-active text-text-base border border-border-light'
                    : 'bg-danger hover:bg-danger-hover text-white shadow-md shadow-danger/10'
                }`}
              >
                <span>Delete for Me</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 bg-transparent hover:bg-bg-surface-hover text-text-muted hover:text-text-base font-semibold rounded-xl text-sm transition-colors mt-1"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
