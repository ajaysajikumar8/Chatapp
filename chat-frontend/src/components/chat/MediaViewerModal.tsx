import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface MediaViewerItem {
  id: string;
  attachmentUrl: string;
  attachmentType: string;
  attachmentName?: string | null;
  createdAt: string;
  senderName?: string;
}

interface MediaViewerModalProps {
  items: MediaViewerItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({ items, currentIndex, onClose, onNavigate }) => {
  const activeMedia = items[currentIndex];
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setZoom(1);
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < items.length - 1) {
        onNavigate(currentIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, items.length, onClose, onNavigate]);

  if (!activeMedia) return null;

  const isImage = activeMedia.attachmentType?.startsWith('image/');
  const isVideo = activeMedia.attachmentType?.startsWith('video/');

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleZoomReset = () => setZoom(1);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 backdrop-blur-md select-none outline-none"
      onClick={onClose}
    >
      {/* Top Header Controls */}
      <div 
        className="h-16 px-6 flex items-center justify-between text-white bg-gradient-to-b from-black/60 to-transparent z-50"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col min-w-0 animate-fade-in">
          <span className="text-sm font-semibold truncate pr-4">{activeMedia.attachmentName || 'Media File'}</span>
          <span className="text-xs opacity-75">
            Sent by {activeMedia.senderName || 'User'} • {new Date(activeMedia.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4">
          {isImage && (
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/5">
              <button 
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors disabled:opacity-50"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button 
                onClick={handleZoomReset}
                className="px-2 text-xs font-medium hover:bg-white/10 rounded-md h-7 transition-colors"
                title="Reset Zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button 
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors disabled:opacity-50"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <button 
            onClick={onClose}
            className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center relative p-4 overflow-hidden">
        {/* Previous Navigation Arrow */}
        {currentIndex > 0 && (
          <button 
            onClick={e => {
              e.stopPropagation();
              onNavigate(currentIndex - 1);
            }}
            className="absolute left-6 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer border border-white/5 shadow-lg shadow-black/30 animate-fade-in"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Media Wrapper */}
        <div 
          className="max-w-full max-h-full flex items-center justify-center relative"
          onClick={e => e.stopPropagation()}
        >
          {isImage && (
            <img 
              src={activeMedia.attachmentUrl} 
              alt={activeMedia.attachmentName || 'Preview'} 
              style={{ transform: `scale(${zoom})` }}
              className="max-w-[90vw] max-h-[80vh] object-contain rounded transition-transform duration-200 ease-out"
            />
          )}

          {isVideo && (
            <div className="relative max-w-[90vw] max-h-[80vh] flex items-center justify-center">
              <video 
                ref={videoRef}
                src={activeMedia.attachmentUrl} 
                className="max-w-[90vw] max-h-[80vh] object-contain rounded"
                autoPlay
                controls
              />
            </div>
          )}
        </div>

        {/* Next Navigation Arrow */}
        {currentIndex < items.length - 1 && (
          <button 
            onClick={e => {
              e.stopPropagation();
              onNavigate(currentIndex + 1);
            }}
            className="absolute right-6 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer border border-white/5 shadow-lg shadow-black/30 animate-fade-in"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Footer Meta Indicator */}
      <div 
        className="h-16 flex items-center justify-center text-white/60 text-xs bg-gradient-to-t from-black/40 to-transparent pointer-events-none z-50"
      >
        Media {currentIndex + 1} of {items.length}
      </div>
    </div>
  );
};
