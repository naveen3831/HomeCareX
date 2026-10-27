export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
  active: boolean;
  iconUrl: string;
  parentId: string | null;
  images: { url: string; alt: string; isPrimary: boolean }[];
  createdAt: string;
  updatedAt: string;
  /** Number of services in this category. */
  services: number;
}
