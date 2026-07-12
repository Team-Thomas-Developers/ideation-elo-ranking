// The fixed set of categories every idea is ranked on 
import { Category } from '../types';

export const CATEGORIES: Category[] = [
  { id: 'enjoyment', label: 'Enjoyment', sort_order: 1 },
  { id: 'feasibility', label: 'Feasibility', sort_order: 2 },
  { id: 'marketability', label: 'Marketability', sort_order: 3 },
  { id: 'innovation', label: 'Innovation', sort_order: 4 },
  { id: 'impact', label: 'Impact', sort_order: 5 },
];

export const CATEGORY_IDS: string[] = CATEGORIES.map((c) => c.id);
