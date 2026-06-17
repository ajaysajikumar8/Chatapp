import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Copy, Edit3, Trash2 } from 'lucide-react';

interface MessageContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  isOwnMessage: boolean;
  canEdit: boolean;
  isText: boolean;
  isDeleted: boolean;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  x,
  y,
  onClose,
  onEdit,
  onDelete,
  onCopy,
  isOwnMessage,
  canEdit,
  isText,
  isDeleted,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    // Use capture phase to make sure it runs before any other click handler closes it prematurely
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [onClose]);

  // Adjust coordinates if it overflows the window boundaries
  const menuWidth = 192; // w-48 is 12rem = 192px
  const menuHeight = 120; 
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  let left = x;
  let top = y;

  if (x + menuWidth > screenWidth) {
    left = screenWidth - menuWidth - 8;
  }
  if (y + menuHeight > screenHeight) {
    top = screenHeight - menuHeight - 8;
  }

  // Ensure menu doesn't go off-screen to the left/top
  left = Math.max(8, left);
  top = Math.max(8, top);

  return (
    <div
      style={{ position: 'fixed', left, top, zIndex: 9999 }}
      className="pointer-events-auto"
    >
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.08 }}
        className="w-48 bg-bg-surface border border-border-light rounded-xl shadow-xl overflow-hidden py-1.5 backdrop-blur-md bg-opacity-95"
      >
        {isText && !isDeleted && (
          <button
            type="button"
            onClick={() => {
              onCopy();
              onClose();
            }}
            className="w-full px-3.5 py-2 text-left text-sm hover:bg-bg-active text-text-base flex items-center gap-2.5 transition-colors"
          >
            <Copy size={15} className="text-text-subtle" />
            <span>Copy Text</span>
          </button>
        )}

        {isOwnMessage && !isDeleted && canEdit && (
          <button
            type="button"
            onClick={() => {
              onEdit();
              onClose();
            }}
            className="w-full px-3.5 py-2 text-left text-sm hover:bg-bg-active text-text-base flex items-center gap-2.5 transition-colors"
          >
            <Edit3 size={15} className="text-text-subtle" />
            <span>Edit Message</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full px-3.5 py-2 text-left text-sm hover:bg-red-500/10 text-red-500 flex items-center gap-2.5 transition-colors border-t border-border-light mt-1 pt-1.5"
        >
          <Trash2 size={15} className="text-red-500" />
          <span>Delete</span>
        </button>
      </motion.div>
    </div>
  );
};
