import { Search, X, Pencil } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNavigateHome: () => void;
  isHome?: boolean;
}

export function Header({ searchQuery, onSearchChange, onNavigateHome }: HeaderProps) {
  return (
    <header className="no-print sticky top-0 z-40 bg-brand-dark/90 backdrop-blur-md border-b border-brand-border/60 py-3 px-4 sm:px-8 transition-all">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand Logo & Title */}
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 group focus:outline-none"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Pencil className="w-5 h-5 text-brand-dark" />
          </div>
          <div className="text-left">
            <h1 className="font-outfit font-extrabold text-xl tracking-tight text-white flex items-center gap-1.5">
              Rowan Draw <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Kids</span>
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">Simple bold-line drawing references</p>
          </div>
        </button>

        {/* Global Search Bar */}
        <div className="relative w-full sm:w-80 md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search drawings (cat, truck, dino)..."
            className="w-full pl-10 pr-10 py-2.5 bg-brand-surface border border-brand-border/80 rounded-full text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
