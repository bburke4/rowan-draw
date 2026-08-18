import { useState } from 'react';
import type { CatalogImage } from '../types/catalog';
import { ArrowLeft, Grid3X3, FlipHorizontal, Printer, Lock, Unlock } from 'lucide-react';

interface DrawingViewerProps {
  image: CatalogImage;
  onBack: () => void;
}

export function DrawingViewer({ image, onBack }: DrawingViewerProps) {
  const [showGrid, setShowGrid] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-between overflow-hidden select-none">
      <div className="hidden print:flex print-only-canvas">
        <img src={image.file} alt={image.description} />
      </div>

      <header
        className={`no-print w-full flex items-center justify-between p-4 bg-brand-dark/90 backdrop-blur-md border-b border-brand-border text-slate-100 transition-opacity duration-300 ${
          isLocked ? 'opacity-20 hover:opacity-100' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-surface hover:bg-slate-800 border border-brand-border text-slate-200 hover:text-amber-400 active:scale-95 transition-all text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="hidden sm:block">
            <h2 className="font-outfit font-bold text-base text-white leading-none">
              {image.description}
            </h2>
            <span className="text-xs text-amber-400 capitalize">
              {image.category} / {image.subject}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showGrid
                ? 'bg-amber-500 text-brand-dark border-amber-400 font-bold shadow-lg shadow-amber-500/20'
                : 'bg-brand-surface text-slate-300 border-brand-border hover:bg-slate-800'
            }`}
            title="Toggle 3x3 Grid Overlay"
          >
            <Grid3X3 className="w-4 h-4" />
            <span className="hidden md:inline">Grid</span>
          </button>

          <button
            onClick={() => setIsMirrored(!isMirrored)}
            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isMirrored
                ? 'bg-amber-500 text-brand-dark border-amber-400 font-bold shadow-lg shadow-amber-500/20'
                : 'bg-brand-surface text-slate-300 border-brand-border hover:bg-slate-800'
            }`}
            title="Mirror / Flip Image"
          >
            <FlipHorizontal className="w-4 h-4" />
            <span className="hidden md:inline">Flip</span>
          </button>

          <button
            onClick={handlePrint}
            className="p-2.5 rounded-xl bg-brand-surface border border-brand-border text-slate-300 hover:text-white hover:bg-slate-800 transition-all text-xs font-semibold flex items-center gap-1.5"
            title="Print Drawing Sheet"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden md:inline">Print</span>
          </button>

          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
              isLocked
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : 'bg-brand-surface text-slate-400 border-brand-border hover:text-slate-200'
            }`}
            title={isLocked ? 'Unlock UI Controls' : 'Lock UI Controls for Toddlers'}
          >
            {isLocked ? <Lock className="w-4 h-4 text-rose-400" /> : <Unlock className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="relative flex-1 w-full max-w-4xl p-4 flex items-center justify-center overflow-hidden">
        <div className="relative w-full h-full max-h-[85vh] flex items-center justify-center">
          <img
            src={image.file}
            alt={image.description}
            className={`max-w-full max-h-full object-contain transition-transform duration-300 ${
              isMirrored ? 'scale-x-[-1]' : ''
            }`}
          />

          {showGrid && (
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-slate-300/60">
              <div className="border border-slate-300/40" />
              <div className="border border-slate-300/40" />
              <div className="border border-slate-300/40" />
              <div className="border border-slate-300/40" />
              <div className="border border-slate-300/40" />
              <div className="border border-slate-300/40" />
              <div className="border border-slate-300/40" />
              <div className="border border-slate-300/40" />
              <div className="border border-slate-300/40" />
            </div>
          )}
        </div>
      </main>

      <footer className="no-print w-full py-2 px-4 bg-slate-100 border-t border-slate-200 text-center text-xs text-slate-500 font-medium">
        Reference image for physical drawing on paper ✏️ • {image.description}
      </footer>
    </div>
  );
}
