export interface Category {
  slug: string;
  name: string;
  icon?: string;
}

export interface CatalogImage {
  id: string;
  file: string;
  category: string;
  subject: string;
  variant: string;
  description: string;
  tags: string[];
  difficulty: number; // 1 = Easy, 2 = Medium, 3 = Challenge
  added: string;
  prompt?: string;
  sourceFile?: string;
}

export interface Manifest {
  version: string;
  categories: Record<string, { name: string }>;
  images: Record<string, Omit<CatalogImage, 'id'>>;
}
