import React, { useEffect, useRef } from 'react';
import { X, Heart } from 'lucide-react';

// Inject the GiveButter script once, regardless of how many times the modal mounts.
let scriptInjected = false;
function ensureGivebutterScript() {
  if (scriptInjected || document.querySelector('script[src*="givebutter"]')) {
    scriptInjected = true;
    return;
  }
  const s = document.createElement('script');
  s.src = 'https://js.givebutter.com/elements/latest.js';
  s.async = true;
  document.head.appendChild(s);
  scriptInjected = true;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function DonateModal({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    ensureGivebutterScript();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="donate-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card — wider to give the widget room to breathe */}
      <div className="relative z-10 bg-white dark:bg-ev-gray-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-3">
          <div className="flex items-center gap-2.5">
            <Heart size={20} className="text-green-500 shrink-0 mt-0.5" fill="currentColor" />
            <h2
              id="donate-modal-title"
              className="text-xl font-bold text-ev-gray-900 dark:text-ev-gray-100"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Thanks for offering to help.
            </h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="ml-4 p-1.5 rounded-lg text-ev-gray-400 hover:text-ev-gray-600 dark:hover:text-ev-gray-300 hover:bg-ev-gray-100 dark:hover:bg-ev-gray-700 transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-4">
          <p className="text-ev-gray-700 dark:text-ev-gray-300 leading-relaxed text-[15px]">
            We will show you how we spend our donations and seek to earn trust through transparency.
            We won't ever sell ads, subscriptions, or user data.
          </p>
          <p className="text-ev-gray-700 dark:text-ev-gray-300 leading-relaxed text-[15px]">
            We prefer small monthly donations, but if you're not in a spot where that makes sense
            or ever need to stop — you will still have full access to all the features.
          </p>

          {/* GiveButter inline widget — React.createElement avoids JSX type declaration issues */}
          {React.createElement('givebutter-widget', { id: 'jb95Pp' })}
        </div>
      </div>
    </div>
  );
}
