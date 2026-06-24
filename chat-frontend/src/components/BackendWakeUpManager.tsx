import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Loader2 } from 'lucide-react';
import axios from 'axios';
import { addConnectionListener } from '../services/socket';

const HEALTH_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const BackendWakeUpManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    let checkTimer: ReturnType<typeof setTimeout> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let elapsedTimer: ReturnType<typeof setInterval> | null = null;

    // 1. Listen to Socket.IO connection status
    const unsubscribeSocket = addConnectionListener((connected) => {
      if (connected) {
        handleSuccess();
      }
    });

    const handleSuccess = () => {
      if (isConnectedRef.current) return;
      isConnectedRef.current = true;
      setIsWakingUp(false);
      if (checkTimer) clearTimeout(checkTimer);
      if (pollInterval) clearInterval(pollInterval);
      if (elapsedTimer) clearInterval(elapsedTimer);
    };

    // 2. Perform initial health check ping
    const runPing = async () => {
      try {
        const res = await axios.get(`${HEALTH_URL}/health`, { timeout: 3000 });
        if (res.status === 200) {
          handleSuccess();
        }
      } catch (err) {
        // Ignore and let Socket.IO or polling wake it up
      }
    };

    runPing();

    // 3. Start a timer to show the waking-up screen if not connected within 1.5 seconds
    checkTimer = setTimeout(() => {
      if (!isConnectedRef.current) {
        setIsWakingUp(true);
        
        // Start counting seconds for the user
        elapsedTimer = setInterval(() => {
          setElapsedTime((prev) => prev + 1);
        }, 1000);

        // Start polling health endpoint
        pollInterval = setInterval(async () => {
          try {
            const res = await axios.get(`${HEALTH_URL}/health`, { timeout: 2000 });
            if (res.status === 200) {
              handleSuccess();
            }
          } catch (err) {
            // keep trying
          }
        }, 2500);
      }
    }, 1500);

    return () => {
      unsubscribeSocket();
      if (checkTimer) clearTimeout(checkTimer);
      if (pollInterval) clearInterval(pollInterval);
      if (elapsedTimer) clearInterval(elapsedTimer);
    };
  }, []);

  return (
    <>
      {children}
      <AnimatePresence>
        {isWakingUp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-xl p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 150 }}
              className="glass-card max-w-md w-full rounded-3xl p-8 md:p-10 border border-white/10 shadow-2xl relative overflow-hidden"
            >
              {/* Decorative radial gradients inside the card */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="text-center relative z-10 flex flex-col items-center">
                {/* Glowing Circle Icon Container */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-indigo-600/20 rounded-full blur-xl animate-pulse" />
                  <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center relative">
                    <Server className="text-primary-light w-10 h-10 animate-bounce duration-1000" />
                    {/* Ring animations */}
                    <span className="absolute inline-flex h-full w-full rounded-full border border-primary/30 animate-ping opacity-75" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-3">
                  Spinning Up Server
                </h2>

                <p className="text-text-muted text-sm leading-relaxed mb-6">
                  Spinning up server instances... This may take up to 45 seconds on the first visit when the application has been idle.
                </p>

                {/* Progress / Connection Status Info */}
                <div className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-light" />
                      Status: Starting instances
                    </span>
                    <span>{elapsedTime}s elapsed</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-indigo-400 rounded-full"
                      initial={{ width: '5%' }}
                      animate={{ 
                        width: ['5%', '30%', '45%', '60%', '75%', '85%', '90%'],
                      }}
                      transition={{ 
                        duration: 45,
                        times: [0, 0.05, 0.15, 0.3, 0.5, 0.8, 1],
                        ease: 'easeOut',
                      }}
                    />
                  </div>
                  <div className="flex justify-center items-center gap-2 mt-1">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <span className="text-[11px] text-text-subtle font-medium">
                      Establishing handshake...
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
