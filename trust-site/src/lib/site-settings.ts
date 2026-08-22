// Единый источник контактов компании. Читает src/content/site/settings.md.
// Используется Footer и Header — правится в админке («Настройки сайта»).
import { getEntry } from 'astro:content';

export interface SiteSettings {
  siteName: string;
  companyName: string;
  companyPhone: string;
  companyPhoneHref: string;
  companyEmail: string;
  companyAddress: string;
  companyUnp: string;
  companyHours: string;
  telegram: string;
  whatsapp: string;
}

const FALLBACK: SiteSettings = {
  siteName: 'ТрастИнкомТрэйд',
  companyName: 'ООО «ТрастИнкомТрэйд»',
  companyPhone: '+375 (XX) XXX-XX-XX',
  companyPhoneHref: 'tel:+375XXXXXXXXX',
  companyEmail: 'info@trustit.by',
  companyAddress: 'г. Минск, ул. Пример, 1',
  companyUnp: 'УНП XXXXXXXXX',
  companyHours: 'Пн–Пт 09:00 – 18:00',
  telegram: 'https://t.me/XXXXXXXXX',
  whatsapp: 'https://wa.me/375XXXXXXXXX',
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const entry = await getEntry('site', 'settings');
  const d = (entry?.data ?? {}) as Record<string, unknown>;
  const pick = (k: keyof SiteSettings) => (d[k] != null && d[k] !== '' ? String(d[k]) : FALLBACK[k]);
  return {
    siteName: pick('siteName'),
    companyName: pick('companyName'),
    companyPhone: pick('companyPhone'),
    companyPhoneHref: pick('companyPhoneHref'),
    companyEmail: pick('companyEmail'),
    companyAddress: pick('companyAddress'),
    companyUnp: pick('companyUnp'),
    companyHours: pick('companyHours'),
    telegram: pick('telegram'),
    whatsapp: pick('whatsapp'),
  };
}
