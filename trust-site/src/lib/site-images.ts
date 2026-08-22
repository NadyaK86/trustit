import { images } from '../data/images';

/**
 * Возвращает URL изображения.
 * - Если значение уже путь (/images/...) или внешний URL (http...) — отдаём как есть
 *   (так работают свои файлы, загруженные через раздел «Изображения» админки).
 * - Иначе считаем значение легаси-ключом из src/data/images.ts (дефолтные картинки).
 */
export function siteImg(value: string): string {
  if (!value) return '';
  if (value.startsWith('/') || value.startsWith('http')) return value;
  const v = (images as Record<string, string>)[value];
  return v ?? '';
}
