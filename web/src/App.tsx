import { useState, useEffect } from 'react';
import { useCatalog } from './hooks/useCatalog';
import type { CatalogImage } from './types/catalog';
import { Header } from './components/Header';
import { CategoryCard } from './components/CategoryCard';
import { DrawingGrid } from './components/DrawingGrid';
import { DrawingViewer } from './components/DrawingViewer';
import { ArrowLeft, Filter, Sparkles } from 'lucide-react';

type ViewMode = { type: 'home' } | { type: 'category'; slug: string } | { type: 'viewer'; image: CatalogImage };

export function App() {
  const {
    images,
    categories,
    loading,
    searchQuery,
    setSearchQuery,
    selectedDifficulty,
    setSelectedDifficulty,
    matchingCategories,
    matchingImages,
  } = useCatalog();

  const [currentView, setCurrentView] = useState<ViewMode>({ type: 'home' });

  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('category/')) {
        const slug = hash.replace('category/', '');
        setCurrentView({ type: 'category', slug });
      } else if (hash.startsWith('view/')) {
        const id = hash.replace('view/', '');
        const targetImg = images.find((i) => i.id === id);
        if (targetImg) {
          setCurrentView({ type: 'viewer', image: targetImg });
        }
      } else {
        setCurrentView({ type: 'home' });
      }
    }

    if (images.length > 0) {
      handleHashChange();
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [images]);

  const navigateToHome = () => {
    setSearchQuery('');
    window.location.hash = '';
    setCurrentView({ type: 'home' });
  };

  const navigateToCategory = (slug: string) => {
    window.location.hash = `category/${slug}`;
    setCurrentView({ type: 'category', slug });
  };

  const navigateToViewer = (image: CatalogImage) => {
    window.location.hash = `view/${image.id}`;
    setCurrentView({ type: 'viewer', image });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center text-slate-100 p-4">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="font-outfit font-bold text-xl">Loading Rowan Draw...</h2>
      </div>
    );
  }

  if (currentView.type === 'viewer') {
    return <DrawingViewer image={currentView.image} onBack={() => window.history.back()} />;
  }

  const activeCategory = currentView.type === 'category'
    ? categories.find((c) => c.slug === currentView.slug)
    : null;

  const categoryImages = currentView.type === 'category'
    ? images.filter((img) => img.category === currentView.slug && (selectedDifficulty === 'all' || img.difficulty === selectedDifficulty))
    : [];

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="min-h-screen bg-brand-dark text-slate-100 flex flex-col">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNavigateHome={navigateToHome}
        isHome={currentView.type === 'home' && !isSearching}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6">
        {isSearching ? (
          <div className="space-y-8">
            {matchingCategories.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h2 className="font-outfit font-bold uppercase tracking-wide text-xs text-slate-300">
                    Matching Categories ({matchingCategories.length})
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {matchingCategories.map((cat) => (
                    <CategoryCard
                      key={cat.slug}
                      slug={cat.slug}
                      name={cat.name}
                      icon={cat.icon}
                      count={cat.count}
                      onClick={() => navigateToCategory(cat.slug)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-outfit font-bold text-lg text-white">
                  Matching Drawings ({matchingImages.length})
                </h2>

                <div className="flex items-center gap-1.5 bg-brand-surface p-1 rounded-xl border border-brand-border text-xs">
                  <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
                  {(['all', 1, 2, 3] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setSelectedDifficulty(lvl)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                        selectedDifficulty === lvl
                          ? 'bg-amber-500 text-brand-dark shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lvl === 'all' ? 'All' : `Lvl ${lvl}`}
                    </button>
                  ))}
                </div>
              </div>

              <DrawingGrid
                images={matchingImages}
                onSelectImage={navigateToViewer}
                emptyTitle="No matching drawings found"
                emptySubtitle={`No drawings matched "${searchQuery}". Try searching for cat, truck, or dino!`}
              />
            </section>
          </div>
        ) : currentView.type === 'category' ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-border">
              <div className="flex items-center gap-3">
                <button
                  onClick={navigateToHome}
                  className="p-2 rounded-xl bg-brand-surface border border-brand-border text-slate-300 hover:text-amber-400 hover:bg-slate-800 transition-all"
                  title="Back to Categories"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="font-outfit font-extrabold text-2xl sm:text-3xl text-white flex items-center gap-2">
                    <span>{activeCategory?.icon || '🎨'}</span>
                    <span>{activeCategory?.name || currentView.slug}</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    {categoryImages.length} drawing {categoryImages.length === 1 ? 'reference' : 'references'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-brand-surface p-1 rounded-xl border border-brand-border text-xs self-start sm:self-auto">
                <span className="text-slate-400 text-xs px-2 font-medium">Difficulty:</span>
                {(['all', 1, 2, 3] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setSelectedDifficulty(lvl)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      selectedDifficulty === lvl
                        ? 'bg-amber-500 text-brand-dark shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lvl === 'all' ? 'All' : `Level ${lvl}`}
                  </button>
                ))}
              </div>
            </div>

            <DrawingGrid
              images={categoryImages}
              onSelectImage={navigateToViewer}
              emptyTitle="No drawings in this level yet"
              emptySubtitle="Try selecting 'All' difficulty levels above."
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-outfit font-extrabold text-2xl sm:text-3xl text-white">
                  Browse Categories
                </h2>
                <p className="text-sm text-slate-400">
                  Pick a topic below or search for what you want to draw
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat) => (
                <CategoryCard
                  key={cat.slug}
                  slug={cat.slug}
                  name={cat.name}
                  icon={cat.icon}
                  count={cat.count}
                  onClick={() => navigateToCategory(cat.slug)}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
