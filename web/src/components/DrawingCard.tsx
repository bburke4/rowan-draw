import type { CatalogImage } from '../types/catalog';

interface DrawingCardProps {
  image: CatalogImage;
  onClick: () => void;
}

export function DrawingCard({ image, onClick }: DrawingCardProps) {
  const getDifficultyBadge = (level: number) => {
    switch (level) {
      case 1:
        return {
          label: 'Level 1 ★',
          bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        };
      case 2:
        return {
          label: 'Level 2 ★★',
          bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        };
      case 3:
        return {
          label: 'Level 3 ★★★',
          bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        };
      default:
        return {
          label: 'Level 1 ★',
          bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        };
    }
  };

  const badge = getDifficultyBadge(image.difficulty);

  return (
    <button
      onClick={onClick}
      className="group flex flex-col bg-brand-surface border border-brand-border/70 rounded-2xl overflow-hidden text-left hover:border-amber-400/50 active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-xl shadow-black/30"
    >
      <div className="relative aspect-square w-full bg-white p-4 flex items-center justify-center overflow-hidden">
        <img
          src={image.file}
          alt={image.description}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute top-2.5 right-2.5">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-md ${badge.bg}`}
          >
            {badge.label}
          </span>
        </div>
      </div>

      <div className="p-3.5 flex flex-col justify-between flex-1">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 block mb-1">
            {image.category} / {image.subject}
          </span>
          <h4 className="font-outfit font-semibold text-sm text-slate-100 line-clamp-2 leading-tight group-hover:text-amber-400 transition-colors">
            "{image.description}"
          </h4>
        </div>

        {image.tags && image.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5 pt-2 border-t border-brand-border/40">
            {image.tags.slice(0, 3).map((tag, i) => (
              <span
                key={i}
                className="text-[10px] text-slate-400 bg-brand-dark/60 px-1.5 py-0.5 rounded border border-brand-border/50"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
