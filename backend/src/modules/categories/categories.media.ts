/**
 * One place that decides which picture of a category the public site and the customer app show.
 * The admin sets it in Categories: the image marked Primary is the cover, otherwise the first one.
 */
export interface CategoryImageLike {
  url?: string | null;
  isPrimary?: boolean | null;
}

export function primaryImageUrl(images?: CategoryImageLike[] | null): string {
  const list = (images ?? []).filter((i) => !!i?.url);
  return (list.find((i) => i.isPrimary) ?? list[0])?.url ?? '';
}
