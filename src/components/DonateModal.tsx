import { useEffect, useRef } from 'react';
import { X, Heart, ShieldCheck, Users } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function DonateModal({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div className="relative z-10 bg-white dark:bg-ev-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">

        {/* Teal hero header */}
        <div className="relative px-6 pt-5 pb-6"
          style={{ background: 'linear-gradient(135deg, #3AABB8 0%, #00657C 60%, #003E4D 100%)' }}>
          <button
            ref={closeRef}
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/15 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3 mb-2.5">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 shrink-0">
              <Heart size={20} className="text-white" fill="currentColor" />
            </div>
            <h2
              id="donate-modal-title"
              className="text-[17px] font-bold text-white leading-tight"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Support free civic transparency
            </h2>
          </div>

          <p className="text-[13px] text-white/75 leading-relaxed pl-[52px]">
            All-volunteer nonprofit &middot; No ads &middot; No subscriptions &middot; No catch.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          <div className="space-y-3">
            <div className="flex gap-3 items-start">
              <ShieldCheck size={17} className="text-ev-teal-500 shrink-0 mt-0.5" />
              <p className="text-ev-gray-700 dark:text-ev-gray-300 text-[14px] leading-relaxed">
                We publish our own finances here — every dollar we receive and spend — holding ourselves to the same standard we hold cities.
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <Users size={17} className="text-ev-teal-500 shrink-0 mt-0.5" />
              <p className="text-ev-gray-700 dark:text-ev-gray-300 text-[14px] leading-relaxed">
                Small monthly donations help most. But you'll always have full access — no donation required, ever.
              </p>
            </div>
          </div>

          <a
            href="https://givebutter.com/g3e9u9"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl font-bold text-[15px] text-white transition-all duration-150 shadow-md hover:shadow-lg hover:-translate-y-px active:translate-y-0"
            style={{ background: 'linear-gradient(135deg, #FF6B52 0%, #FF5740 50%, #E61B00 100%)', color: 'white' }}
          >
            <Heart size={16} fill="currentColor" />
            Donate on Givebutter
          </a>

          <p className="text-center text-ev-gray-400 dark:text-ev-gray-500 text-[12px]">
            Empowered Vote is a volunteer-run nonprofit.
          </p>
        </div>
      </div>
    </div>
  );
}
