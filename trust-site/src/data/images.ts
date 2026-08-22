/**
 * Курированные стоковые фото (AV, панели, переговорные, инфраструктура).
 * Unsplash: fm=webp + auto=format для меньшего веса (п. 3.3 ТЗ).
 * Замените на файлы в /public/images при появлении своих материалов.
 */
const HERO_PHOTO_ID = '1601132359864-c974e79890ac';

/** @param q качество 1–100 (ниже — меньше вес) */
export function unsplash(photoId: string, w: number, q: number = 75): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${w}&q=${q}&fm=webp`;
}

/** Unsplash+ (`plus.unsplash.com/premium_photo-…`) — иной путь, чем у `unsplash()` */
export function unsplashPlus(slug: string, w: number, q: number = 60): string {
  return `https://plus.unsplash.com/${slug}?auto=format&fit=crop&w=${w}&q=${q}&fm=webp`;
}

function heroUrl(w: number, q = 78) {
  return unsplash(HERO_PHOTO_ID, w, q);
}

/** Главная hero: mobile-first srcset для LCP (п. 3.3 ТЗ) */
export const heroImage = {
  /** Fallback src — средняя ширина для первого кадра */
  src: heroUrl(1280),
  srcset: `${heroUrl(640)} 640w, ${heroUrl(960)} 960w, ${heroUrl(1280)} 1280w, ${heroUrl(1920)} 1920w`,
  preloadSrcset: `${heroUrl(640)} 640w, ${heroUrl(960)} 960w, ${heroUrl(1280)} 1280w, ${heroUrl(1920)} 1920w`,
  sizes: '100vw',
} as const;

export const images = {
  /** Полноразмерный URL hero (OG/редиректы при необходимости) */
  heroBackground: heroUrl(1920),
  directionSmartPlayer: unsplash('1604818659418-1c53672b00f6', 900, 60),
  directionAV: 'https://placehold.co/900x600/0F1929/4f8cff?text=AV+Solutions',
  directionMeeting: unsplashPlus('premium_photo-1681487144031-d502ea9abefc', 900, 60),
  directionIT: unsplashPlus('premium_photo-1682145181120-73cfdfc8a36d', 900, 60),
  portfolioRetail: unsplashPlus('premium_photo-1679690708693-9842cf1d3893', 900, 60),
  portfolioOffice: unsplash('1497366754035-f200968a6e72', 800),
  portfolioHoreca: unsplash('1556742049-0cfed4f6a45d', 800),
  newsPlatform: unsplash('1551288049-bebda4e38f71', 600),
  newsCompany: unsplash('1497366216548-37526070297c', 600),
  newsAnalytics: unsplash('1460925895917-afdab827c52f', 600),
  servicesCycle: unsplashPlus('premium_photo-1661740556958-8414e3c62f58', 900, 60),
  parallaxSmartplayerPromo: unsplash('1511578314322-379afb476865', 1920, 72),
  parallaxCta: unsplash('1522071820081-009f0129c71c', 1920, 72),
  parallaxAbout: unsplash('1497366216548-37526070297c', 1920, 72),
  smartplayerHeroVisual: unsplash('1551288049-bebda4e38f71', 900, 78),
  smartplayerParallax: unsplash('1542744173-8e7e5348bb03', 1920, 72),
  industryRetail: unsplashPlus('premium_photo-1679690708693-9842cf1d3893', 900, 60),
  industryOffice: unsplash('1497366216548-37526070297c', 800, 70),
  industryHoreca: unsplash('1556742049-0cfed4f6a45d', 800, 70),
  industryGov: unsplash('1568992687947-868a62a9f521', 800, 70),
  industryMedical: unsplash('1519494026892-80bbd2d6fd0d', 800, 70),
  industryManufacturing: unsplashPlus('premium_photo-1661740556958-8414e3c62f58', 900, 60),
  avInteractivePanels: 'https://placehold.co/900x600/0F1929/4f8cff?text=Interactive+Panels+%2F+Lumien',
  avVideoWalls: unsplash('1517292987719-0369a794ec0f', 900, 65),
  avKiosks: unsplash('1521295121783-8a321d551ad2', 900, 65),
  avTransparent: unsplash('1551817958-c5b51e7b4a33', 900, 65),
  avLedCubes: unsplash('1492684223066-81342ee5ff30', 900, 65),
  avProMonitors: unsplash('1542838132-92c53300491e', 900, 65),
  roomSmall: unsplash('1497366811353-6870744d04b2', 900, 65),
  roomMedium: unsplash('1497366216548-37526070297c', 900, 65),
  roomLarge: unsplash('1431540015161-0bf868a2d407', 900, 65),
  roomXl: unsplash('1517048676732-d65bc937f952', 900, 65),
  itInfraHero: unsplash('1558494949-ef010cbdcc31', 1200, 70),
  dsHowItWorks: 'https://optim.tildacdn.com/tild6363-6166-4430-a165-633131616561/-/format/webp/scheme.png.webp',
  spCertificate: 'https://placehold.co/600x820/ffffff/0F1929?text=SmartPlayer+Certificate%0A%28Official+Partner%29',
  industryBanking: unsplash('1601597111158-2fceff292cdc', 900, 60),
  industryGasStations: unsplash('1545459720-aac8509eb02c', 900, 60),
  industryPharmacy: unsplash('1587854692152-cbe660dbde88', 900, 60),
  industryEducation: unsplash('1523050854058-8df90110c9f1', 900, 60),
  industryMuseums: unsplash('1565060169187-5284a3963cb7', 900, 60),
  industrySports: unsplash('1534438327276-14e5300c3a48', 900, 60),
  industryCorporateTV: unsplash('1542744173-8e7e5348bb03', 900, 60),
} as const;
