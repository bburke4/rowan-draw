import type { CatalogImage } from '../types/catalog';
import { DrawingCard } from './DrawingCard';
import { ImageOff } from 'lucide-react';

interface DrawingGridProps {
  images: CatalogImage[];
  onSelectImage: (image: CatalogImage) => void;
  emptyTitle?: string;
  emptySubtitle?: string;
}

export function DrawingGrid({
  images,
  onSelectImage,
  emptyTitle = 'No drawings found',
  emptySubtitle = 'Try searching for something else or picking another category',
}: DrawingGridProps) {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-brand-surface/40 border border-dashed border-brand-border rounded-3xl my-6">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-400 mb-3">
          <ImageOff className="w-7 h-7 text-amber-400/80" />
        </div>
        <h3 className="font-outfit font-bold text-lg text-slate-200 mb-1">{emptyTitle}</h3>
        <p className="text-sm text-slate-400 max-w-sm">{emptySubtitle}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5">
      {images.map((img) => (
        <DrawingCard key={img.id} image={img} onClick={() => onSelectImage(img)} />
      ))}
    </div>
  );
}
