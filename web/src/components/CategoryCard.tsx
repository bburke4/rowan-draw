import { ChevronRight } from 'lucide-react';

interface CategoryCardProps {
  slug: string;
  name: string;
  icon?: string;
  count: number;
  onClick: () => void;
}

export function CategoryCard({ name, icon, count, onClick }: CategoryCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col justify-between p-5 bg-brand-surface border border-brand-border/70 rounded-3xl text-left hover:border-amber-400/50 hover:bg-brand-surface/80 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-black/20 overflow-hidden"
    >
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors" />

      <div className="flex items-start justify-between mb-6">
        <span className="text-4xl sm:text-5xl group-hover:scale-110 transition-transform duration-200 inline-block drop-shadow-md">
          {icon || '🎨'}
        </span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700/60">
          {count} {count === 1 ? 'drawing' : 'drawings'}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-outfit font-bold text-lg text-white group-hover:text-amber-400 transition-colors">
          {name}
        </h3>
        <div className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition-all">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
}
