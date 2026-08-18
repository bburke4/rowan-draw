import { useState, useEffect, useMemo } from 'react';
import type { CatalogImage, Manifest } from '../types/catalog';

const CATEGORY_EMOJIS: Record<string, string> = {
  animals: '🐱',
  vehicles: '🚗',
  nature: '🌻',
  food: '🍕',
  buildings: '🏰',
  people: '🤖',
};

const MOCK_FALLBACK_IMAGES: CatalogImage[] = [
  {
    id: 'img_animals_cat_sitting_cat_1',
    file: 'library/animals/cat/img_animals_cat_sitting_cat_1.png',
    category: 'animals',
    subject: 'cat',
    variant: 'sitting-cat',
    description: 'Sitting cat facing forward with whiskers and pointed ears',
    tags: ['cat', 'kitty', 'kitten', 'pet', 'animal'],
    difficulty: 1,
    added: '2026-07-30',
  },
  {
    id: 'img_vehicles_truck_garbage_truck_compartment_4',
    file: 'library/vehicles/truck/img_vehicles_truck_garbage_truck_compartment_4.png',
    category: 'vehicles',
    subject: 'truck',
    variant: 'garbage-truck-compartment',
    description: 'Side profile outline of a simple cartoon garbage truck',
    tags: ['truck', 'garbage truck', 'vehicle', 'auto'],
    difficulty: 2,
    added: '2026-07-30',
  },
];

export function useCatalog() {
  const [images, setImages] = useState<CatalogImage[]>([]);
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | 'all'>('all');

  useEffect(() => {
    async function loadManifest() {
      try {
        const res = await fetch('/manifest.json');
        if (!res.ok) throw new Error('Failed to fetch manifest');
        const data: Manifest = await res.json();
        
        const catMap: Record<string, string> = {};
        if (data.categories) {
          for (const [slug, meta] of Object.entries(data.categories)) {
            catMap[slug] = meta.name;
          }
        }
        setCategoriesMap(catMap);

        const loadedImages: CatalogImage[] = Object.entries(data.images || {}).map(([id, info]) => ({
          id,
          file: info.file.startsWith('/') ? info.file : `/${info.file}`,
          category: info.category,
          subject: info.subject,
          variant: info.variant,
          description: info.description || info.subject,
          tags: info.tags || [],
          difficulty: info.difficulty || 1,
          added: info.added,
          prompt: info.prompt,
        }));

        setImages(loadedImages.length > 0 ? loadedImages : MOCK_FALLBACK_IMAGES);
      } catch (err) {
        console.warn('Using fallback catalog:', err);
        setImages(MOCK_FALLBACK_IMAGES);
      } finally {
        setLoading(false);
      }
    }
    loadManifest();
  }, []);

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const img of images) {
      counts[img.category] = (counts[img.category] || 0) + 1;
    }

    const slugs = Array.from(new Set([...Object.keys(categoriesMap), ...Object.keys(counts)]));
    return slugs.map((slug) => ({
      slug,
      name: categoriesMap[slug] || slug.charAt(0).toUpperCase() + slug.slice(1),
      icon: CATEGORY_EMOJIS[slug] || '🎨',
      count: counts[slug] || 0,
    }));
  }, [images, categoriesMap]);

  const matchingCategories = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
    );
  }, [categories, searchQuery]);

  const matchingImages = useMemo(() => {
    let result = images;

    if (selectedDifficulty !== 'all') {
      result = result.filter((img) => img.difficulty === selectedDifficulty);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((img) => {
        const matchesSubject = img.subject.toLowerCase().includes(q);
        const matchesDescription = img.description.toLowerCase().includes(q);
        const matchesCategory = img.category.toLowerCase().includes(q);
        const matchesTags = img.tags.some((t) => t.toLowerCase().includes(q));
        return matchesSubject || matchesDescription || matchesCategory || matchesTags;
      });
    }

    return result;
  }, [images, searchQuery, selectedDifficulty]);

  return {
    images,
    categories,
    loading,
    searchQuery,
    setSearchQuery,
    selectedDifficulty,
    setSelectedDifficulty,
    matchingCategories,
    matchingImages,
  };
}
