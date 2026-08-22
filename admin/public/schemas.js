// Schemas describe form structure for each page. Used by app.js for typed editing.
// Field types: text, textarea, longtext, url, image, image-key, select, number, boolean, list, group

export const SCHEMAS = {
  'site/home': {
    title: 'Главная',
    groups: [
      {
        label: 'Hero (верхний блок)',
        fields: [
          { key: 'heroBadge', label: 'Бейдж', type: 'text' },
          { key: 'heroPartnerLabel', label: 'Текст партнёрской ссылки', type: 'text' },
          { key: 'heroPartnerHref', label: 'Ссылка партнёрского бейджа', type: 'url' },
          { key: 'heroTitleLine1', label: 'Заголовок — первая строка', type: 'text' },
          { key: 'heroTitleGradient', label: 'Заголовок — вторая строка (градиент)', type: 'text' },
          { key: 'heroLead', label: 'Подзаголовок', type: 'longtext' },
        ],
      },
      {
        label: 'Направления (4 карточки)',
        fields: [
          { key: 'directionsSectionEyebrow', label: 'Eyebrow', type: 'text' },
          { key: 'directionsSectionTitle', label: 'Заголовок', type: 'text' },
          { key: 'directionsSectionLinkHref', label: 'Ссылка «Все решения»', type: 'url' },
          { key: 'directionsSectionLinkLabel', label: 'Подпись ссылки', type: 'text' },
          {
            key: 'directions',
            label: 'Карточки направлений',
            type: 'list',
            itemSchema: {
              fields: [
                { key: 'num', label: 'Номер', type: 'text' },
                { key: 'title', label: 'Название', type: 'text' },
                { key: 'tag', label: 'Тег', type: 'text' },
                { key: 'desc', label: 'Описание', type: 'longtext' },
                { key: 'href', label: 'Ссылка', type: 'url' },
                { key: 'imageKey', label: 'Изображение', type: 'image' },
              ],
            },
          },
        ],
      },
      {
        label: 'Цикл услуг',
        fields: [
          { key: 'cycleEyebrow', label: 'Eyebrow', type: 'text' },
          { key: 'cycleTitle', label: 'Заголовок (можно с переносами)', type: 'longtext' },
          { key: 'cycleLead', label: 'Описание', type: 'longtext' },
          { key: 'cycleImageKey', label: 'Изображение', type: 'image' },
          { key: 'cycleImageAlt', label: 'Alt изображения', type: 'text' },
          {
            key: 'homeServices',
            label: 'Услуги на главной',
            type: 'list',
            itemSchema: {
              fields: [
                { key: 'iconId', label: 'ID иконки', type: 'select', options: ['content', 'commissioning', 'installation', 'support'] },
                { key: 'title', label: 'Название', type: 'text' },
                { key: 'desc', label: 'Описание', type: 'longtext' },
                { key: 'href', label: 'Ссылка', type: 'url' },
              ],
            },
          },
        ],
      },
      {
        label: 'Промо-блок SmartPlayer',
        fields: [
          { key: 'promoEyebrow', label: 'Eyebrow', type: 'text' },
          { key: 'promoTitle', label: 'Заголовок', type: 'text' },
          { key: 'promoLead', label: 'Описание', type: 'longtext' },
          { key: 'promoCtaPrimaryLabel', label: 'CTA primary — подпись', type: 'text' },
          { key: 'promoCtaPrimaryHref', label: 'CTA primary — ссылка', type: 'url' },
          { key: 'promoCtaSecondaryLabel', label: 'CTA secondary — подпись', type: 'text' },
          { key: 'promoCtaSecondaryHref', label: 'CTA secondary — ссылка', type: 'url' },
          { key: 'parallaxPromoImageKey', label: 'Фон промо', type: 'image' },
        ],
      },
      {
        label: 'Портфолио (превью)',
        fields: [
          { key: 'portfolioEyebrow', label: 'Eyebrow', type: 'text' },
          { key: 'portfolioTitle', label: 'Заголовок', type: 'text' },
          { key: 'portfolioLinkHref', label: 'Ссылка «Все проекты»', type: 'url' },
          { key: 'portfolioLinkLabel', label: 'Подпись ссылки', type: 'text' },
          {
            key: 'portfolio',
            label: 'Карточки портфолио',
            type: 'list',
            itemSchema: {
              fields: [
                { key: 'sector', label: 'Сектор', type: 'text' },
                { key: 'title', label: 'Заголовок', type: 'text' },
                { key: 'desc', label: 'Описание', type: 'longtext' },
                { key: 'imageKey', label: 'Изображение', type: 'image' },
                { key: 'tags', label: 'Теги', type: 'string-list' },
              ],
            },
          },
        ],
      },
      {
        label: 'Новости (превью)',
        fields: [
          { key: 'newsEyebrow', label: 'Eyebrow', type: 'text' },
          { key: 'newsTitle', label: 'Заголовок', type: 'text' },
          { key: 'newsLinkHref', label: 'Ссылка «Все новости»', type: 'url' },
          { key: 'newsLinkLabel', label: 'Подпись ссылки', type: 'text' },
          {
            key: 'homeNews',
            label: 'Карточки новостей',
            type: 'list',
            itemSchema: {
              fields: [
                { key: 'tag', label: 'Тег', type: 'text' },
                { key: 'date', label: 'Дата', type: 'text' },
                { key: 'title', label: 'Заголовок', type: 'text' },
                { key: 'href', label: 'Ссылка', type: 'url' },
                { key: 'imageKey', label: 'Изображение', type: 'image' },
              ],
            },
          },
        ],
      },
      {
        label: 'Финальный CTA',
        fields: [
          { key: 'finalCtaTitle', label: 'Заголовок', type: 'text' },
          { key: 'finalCtaLead', label: 'Описание', type: 'longtext' },
          { key: 'finalCtaPrimaryLabel', label: 'CTA primary — подпись', type: 'text' },
          { key: 'finalCtaPrimaryHref', label: 'CTA primary — ссылка', type: 'url' },
          { key: 'finalCtaSecondaryLabel', label: 'CTA secondary — подпись', type: 'text' },
          { key: 'finalCtaSecondaryHref', label: 'CTA secondary — ссылка', type: 'url' },
          { key: 'parallaxCtaImageKey', label: 'Фон финального CTA', type: 'image' },
        ],
      },
      {
        label: 'Форма «Получить расчёт»',
        fields: [
          { key: 'formEstimateTitle', label: 'Заголовок формы', type: 'text' },
          { key: 'formEstimateSubtitle', label: 'Подзаголовок', type: 'longtext' },
        ],
      },
      {
        label: 'SEO',
        fields: [
          { key: 'title', label: 'Title (вкладка браузера)', type: 'text' },
          { key: 'description', label: 'Description', type: 'longtext' },
        ],
      },
    ],
  },

  'site/navigation': {
    title: 'Меню и контакты',
    groups: [
      {
        label: 'Бренд',
        fields: [
          { key: 'brandName', label: 'Название компании', type: 'text' },
          { key: 'brandLetter', label: 'Буква в логотипе', type: 'text' },
        ],
      },
      {
        label: 'Пункты меню',
        fields: [
          {
            key: 'items',
            label: 'Пункты меню',
            type: 'list',
            itemSchema: {
              fields: [
                { key: 'label', label: 'Подпись', type: 'text' },
                { key: 'href', label: 'Ссылка', type: 'url' },
              ],
            },
          },
        ],
      },
      {
        label: 'Контакты в шапке',
        fields: [
          { key: 'contacts.whatsapp', label: 'WhatsApp URL', type: 'url' },
          { key: 'contacts.telegram', label: 'Telegram URL', type: 'url' },
          { key: 'contacts.callbackLabel', label: 'Подпись кнопки', type: 'text' },
          { key: 'contacts.callbackHref', label: 'Ссылка кнопки', type: 'url' },
        ],
      },
    ],
  },

  'site/settings': {
    title: 'Настройки сайта',
    groups: [
      {
        label: 'Основное',
        fields: [
          { key: 'siteName', label: 'Название сайта', type: 'text' },
          { key: 'siteUrl', label: 'URL сайта', type: 'url' },
          { key: 'defaultDescription', label: 'Описание по умолчанию', type: 'longtext' },
          { key: 'defaultOgImage', label: 'OG-изображение', type: 'url' },
        ],
      },
      {
        label: 'Компания (контакты сайта: подвал, шапка)',
        fields: [
          { key: 'companyName', label: 'Юр. название', type: 'text' },
          { key: 'companyPhone', label: 'Телефон (текст)', type: 'text' },
          { key: 'companyPhoneHref', label: 'Телефон (ссылка tel:)', type: 'text' },
          { key: 'companyEmail', label: 'Email', type: 'text' },
          { key: 'companyAddress', label: 'Адрес', type: 'text' },
          { key: 'companyUnp', label: 'УНП', type: 'text' },
          { key: 'companyHours', label: 'Часы работы', type: 'text' },
        ],
      },
      {
        label: 'Мессенджеры',
        fields: [
          { key: 'telegram', label: 'Telegram (ссылка)', type: 'url' },
          { key: 'whatsapp', label: 'WhatsApp (ссылка)', type: 'url' },
        ],
      },
    ],
  },

  'site/digital-signage': {
    title: 'Digital Signage (SmartPlayer)',
    groups: [
      {
        label: 'Hero',
        fields: [
          { key: 'heroBadge', label: 'Бейдж', type: 'text' },
          { key: 'heroTitle', label: 'Заголовок', type: 'text' },
          { key: 'heroLead', label: 'Лид', type: 'longtext' },
          { key: 'heroSub', label: 'Подзаголовок', type: 'longtext' },
          { key: 'heroCtaPrimaryLabel', label: 'Primary CTA', type: 'text' },
          { key: 'heroCtaPrimaryHref', label: 'Primary CTA ссылка', type: 'text' },
          { key: 'heroCtaSecondaryLabel', label: 'Secondary CTA', type: 'text' },
          { key: 'heroCtaSecondaryHref', label: 'Secondary CTA ссылка', type: 'text' },
          { key: 'heroVisualImageKey', label: 'Hero изображение', type: 'image' },
          { key: 'heroVisualAlt', label: 'Alt hero', type: 'text' },
          { key: 'heroStatLabel', label: 'Подпись метрики', type: 'text' },
          { key: 'heroStatValue', label: 'Значение метрики', type: 'text' },
        ],
      },
      {
        label: 'Возможности',
        fields: [
          { key: 'featuresEyebrow', label: 'Eyebrow', type: 'text' },
          { key: 'featuresTitle', label: 'Заголовок', type: 'text' },
          {
            key: 'features',
            label: 'Возможности',
            type: 'list',
            itemSchema: { fields: [
              { key: 'title', label: 'Название', type: 'text' },
              { key: 'desc', label: 'Описание', type: 'longtext' },
            ]},
          },
        ],
      },
      {
        label: 'Отрасли',
        fields: [
          { key: 'industriesEyebrow', label: 'Eyebrow', type: 'text' },
          { key: 'industriesTitle', label: 'Заголовок', type: 'text' },
          { key: 'industriesLead', label: 'Лид', type: 'longtext' },
          {
            key: 'industries',
            label: 'Карточки отраслей',
            type: 'list',
            itemSchema: { fields: [
              { key: 'slug', label: 'Slug (используется в URL)', type: 'text' },
              { key: 'title', label: 'Название', type: 'text' },
              { key: 'tag', label: 'Тег', type: 'text' },
              { key: 'desc', label: 'Описание', type: 'longtext' },
              { key: 'imageKey', label: 'Изображение', type: 'image' },
            ]},
          },
        ],
      },
      {
        label: 'Этапы внедрения',
        fields: [
          { key: 'stepsEyebrow', label: 'Eyebrow', type: 'text' },
          { key: 'stepsTitle', label: 'Заголовок', type: 'text' },
          {
            key: 'steps',
            label: 'Шаги',
            type: 'list',
            itemSchema: { fields: [
              { key: 'num', label: 'Номер', type: 'text' },
              { key: 'title', label: 'Название', type: 'text' },
              { key: 'desc', label: 'Описание', type: 'longtext' },
            ]},
          },
        ],
      },
      {
        label: 'Параллакс CTA',
        fields: [
          { key: 'parallaxEyebrow', label: 'Eyebrow', type: 'text' },
          { key: 'parallaxTitle', label: 'Заголовок', type: 'text' },
          { key: 'parallaxLead', label: 'Лид', type: 'longtext' },
          { key: 'parallaxCtaLabel', label: 'CTA подпись', type: 'text' },
          { key: 'parallaxCtaHref', label: 'CTA ссылка', type: 'text' },
          { key: 'parallaxImageKey', label: 'Фон', type: 'image' },
        ],
      },
      {
        label: 'Форма',
        fields: [
          { key: 'formTitle', label: 'Заголовок формы', type: 'text' },
          { key: 'formSubtitle', label: 'Подзаголовок', type: 'longtext' },
        ],
      },
      {
        label: 'Детали страниц отраслей (industryDetails)',
        fields: [
          { key: 'industryDetails', label: 'Тексты страниц отраслей', type: 'industry-details' },
        ],
      },
      { label: 'SEO', fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'description', label: 'Description', type: 'longtext' },
      ]},
    ],
  },

  'site/av-systems': {
    title: 'Аудиовизуальные системы',
    groups: [
      { label: 'Hero', fields: [
        { key: 'heroBadge', label: 'Бейдж', type: 'text' },
        { key: 'pageTitle', label: 'Заголовок страницы', type: 'text' },
        { key: 'lead', label: 'Лид', type: 'longtext' },
        { key: 'heroImageKey', label: 'Hero изображение', type: 'image' },
      ]},
      { label: 'Категории', fields: [
        { key: 'categories', label: 'Категории', type: 'list', itemSchema: { fields: [
          { key: 'slug', label: 'Slug', type: 'text' },
          { key: 'title', label: 'Название', type: 'text' },
          { key: 'desc', label: 'Описание', type: 'longtext' },
          { key: 'imageKey', label: 'Изображение', type: 'image' },
          { key: 'sourceLabel', label: 'Подпись источника', type: 'text' },
          { key: 'sourceHref', label: 'URL источника', type: 'url' },
          { key: 'specs', label: 'Характеристики', type: 'string-list' },
        ]}},
      ]},
      { label: 'Форма', fields: [
        { key: 'formTitle', label: 'Заголовок формы', type: 'text' },
        { key: 'formSubtitle', label: 'Подзаголовок', type: 'longtext' },
      ]},
      { label: 'SEO', fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'description', label: 'Description', type: 'longtext' },
      ]},
    ],
  },

  'site/meeting-rooms': {
    title: 'Переговорные комнаты',
    groups: [
      { label: 'Hero', fields: [
        { key: 'heroBadge', label: 'Бейдж', type: 'text' },
        { key: 'pageTitle', label: 'Заголовок', type: 'text' },
        { key: 'lead', label: 'Лид', type: 'longtext' },
        { key: 'heroImageKey', label: 'Hero изображение', type: 'image' },
      ]},
      { label: 'Типы переговорных', fields: [
        { key: 'roomTypesEyebrow', label: 'Eyebrow', type: 'text' },
        { key: 'roomTypesTitle', label: 'Заголовок', type: 'text' },
        { key: 'roomTypesLead', label: 'Лид', type: 'longtext' },
        { key: 'roomTypes', label: 'Список типов', type: 'list', itemSchema: { fields: [
          { key: 'slug', label: 'Slug', type: 'text' },
          { key: 'size', label: 'Размер (Small/Medium/Large/XL)', type: 'text' },
          { key: 'title', label: 'Название', type: 'text' },
          { key: 'desc', label: 'Описание', type: 'longtext' },
          { key: 'capacity', label: 'Вместимость', type: 'text' },
          { key: 'imageKey', label: 'Изображение', type: 'image' },
          { key: 'bullets', label: 'Состав', type: 'string-list' },
        ]}},
      ]},
      { label: 'Решения / системы', fields: [
        { key: 'solutionsEyebrow', label: 'Eyebrow', type: 'text' },
        { key: 'solutionsTitle', label: 'Заголовок', type: 'text' },
        { key: 'solutions', label: 'Блоки решений', type: 'list', itemSchema: { fields: [
          { key: 'slug', label: 'Slug', type: 'text' },
          { key: 'title', label: 'Название', type: 'text' },
          { key: 'desc', label: 'Описание', type: 'longtext' },
          { key: 'href', label: 'Ссылка', type: 'text' },
          { key: 'cta', label: 'CTA подпись', type: 'text' },
          { key: 'bullets', label: 'Bullet-список', type: 'string-list' },
        ]}},
      ]},
      { label: 'Форма', fields: [
        { key: 'formTitle', label: 'Заголовок формы', type: 'text' },
        { key: 'formSubtitle', label: 'Подзаголовок', type: 'longtext' },
      ]},
      { label: 'SEO', fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'description', label: 'Description', type: 'longtext' },
      ]},
    ],
  },

  'site/it-infrastructure': {
    title: 'IT-инфраструктура',
    groups: [
      { label: 'Hero', fields: [
        { key: 'heroBadge', label: 'Бейдж', type: 'text' },
        { key: 'pageTitle', label: 'Заголовок', type: 'text' },
        { key: 'lead', label: 'Лид', type: 'longtext' },
        { key: 'heroImageKey', label: 'Hero изображение', type: 'image' },
      ]},
      { label: 'Направления', fields: [
        { key: 'items', label: 'Направления IT', type: 'list', itemSchema: { fields: [
          { key: 'title', label: 'Название', type: 'text' },
          { key: 'desc', label: 'Описание', type: 'longtext' },
          { key: 'bullets', label: 'Bullet-список', type: 'string-list' },
          { key: 'sourceLabel', label: 'Подпись источника', type: 'text' },
          { key: 'sourceHref', label: 'URL источника', type: 'url' },
        ]}},
      ]},
      { label: 'Вендоры', fields: [
        { key: 'vendorsTitle', label: 'Заголовок', type: 'text' },
        { key: 'vendorsLead', label: 'Лид', type: 'longtext' },
        { key: 'vendors', label: 'Список вендоров', type: 'list', itemSchema: { fields: [
          { key: 'name', label: 'Название', type: 'text' },
          { key: 'desc', label: 'Описание', type: 'longtext' },
          { key: 'href', label: 'URL', type: 'url' },
        ]}},
      ]},
      { label: 'Форма', fields: [
        { key: 'formTitle', label: 'Заголовок формы', type: 'text' },
        { key: 'formSubtitle', label: 'Подзаголовок', type: 'longtext' },
      ]},
      { label: 'SEO', fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'description', label: 'Description', type: 'longtext' },
      ]},
    ],
  },

  'site/solutions': {
    title: 'Список решений',
    groups: [
      { label: 'Шапка', fields: [
        { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
        { key: 'pageTitle', label: 'Заголовок', type: 'text' },
        { key: 'lead', label: 'Лид', type: 'longtext' },
      ]},
      { label: 'Решения', fields: [
        { key: 'solutions', label: 'Карточки', type: 'list', itemSchema: { fields: [
          { key: 'title', label: 'Название', type: 'text' },
          { key: 'tag', label: 'Тег', type: 'text' },
          { key: 'desc', label: 'Описание', type: 'longtext' },
          { key: 'href', label: 'Ссылка', type: 'url' },
          { key: 'features', label: 'Список features', type: 'string-list' },
        ]}},
      ]},
      { label: 'SEO', fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'description', label: 'Description', type: 'longtext' },
      ]},
    ],
  },

  'site/services': {
    title: 'Услуги',
    groups: [
      { label: 'Шапка', fields: [
        { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
        { key: 'pageTitle', label: 'Заголовок', type: 'text' },
        { key: 'lead', label: 'Лид', type: 'longtext' },
      ]},
      { label: 'Услуги', fields: [
        { key: 'services', label: 'Список услуг', type: 'list', itemSchema: { fields: [
          { key: 'id', label: 'ID (для якоря)', type: 'text' },
          { key: 'num', label: 'Номер', type: 'text' },
          { key: 'title', label: 'Название', type: 'text' },
          { key: 'desc', label: 'Описание', type: 'longtext' },
          { key: 'items', label: 'Bullet-список', type: 'string-list' },
        ]}},
        { key: 'sectionCtaLabel', label: 'Подпись CTA', type: 'text' },
      ]},
      { label: 'Форма', fields: [
        { key: 'formTitle', label: 'Заголовок формы', type: 'text' },
        { key: 'formSubtitle', label: 'Подзаголовок', type: 'longtext' },
      ]},
      { label: 'SEO', fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'description', label: 'Description', type: 'longtext' },
      ]},
    ],
  },

  'site/about': { title: 'О компании', groups: [{ label: 'Контент', fields: [] }], dynamic: true },
  'site/contacts': {
    title: 'Контакты',
    groups: [
      {
        label: 'Шапка',
        fields: [
          { key: 'heroEyebrow', label: 'Надзаголовок', type: 'text' },
          { key: 'heroTitle', label: 'Заголовок', type: 'text' },
        ],
      },
      {
        label: 'Подписи блоков',
        hint: 'Сами телефон/email/адрес берутся из «Настроек сайта»',
        fields: [
          { key: 'phoneTitle', label: 'Телефон — заголовок', type: 'text' },
          { key: 'phoneHint', label: 'Телефон — подсказка', type: 'text' },
          { key: 'emailTitle', label: 'Email — заголовок', type: 'text' },
          { key: 'emailHint', label: 'Email — подсказка', type: 'text' },
          { key: 'messengersTitle', label: 'Мессенджеры — заголовок', type: 'text' },
          { key: 'telegramLabel', label: 'Подпись Telegram', type: 'text' },
          { key: 'whatsappLabel', label: 'Подпись WhatsApp', type: 'text' },
          { key: 'officeTitle', label: 'Офис — заголовок', type: 'text' },
          { key: 'mapPlaceholder', label: 'Заглушка карты', type: 'text' },
        ],
      },
      {
        label: 'Форма обратного звонка',
        fields: [
          { key: 'callbackFormTitle', label: 'Заголовок формы', type: 'text' },
          { key: 'callbackFormSubtitle', label: 'Подзаголовок', type: 'longtext' },
        ],
      },
      {
        label: 'SEO',
        fields: [
          { key: 'title', label: 'Title (вкладка)', type: 'text' },
          { key: 'description', label: 'Description', type: 'longtext' },
        ],
      },
    ],
  },

  'site/catalog': {
    title: 'Каталог',
    groups: [
      {
        label: 'Шапка',
        fields: [
          { key: 'eyebrow', label: 'Надзаголовок', type: 'text' },
          { key: 'pageTitle', label: 'Заголовок', type: 'text' },
          { key: 'lead', label: 'Вступление', type: 'longtext' },
        ],
      },
      {
        label: 'Категории',
        fields: [
          {
            key: 'categories',
            label: 'Категории товаров',
            type: 'list',
            itemSchema: {
              fields: [
                { key: 'title', label: 'Название', type: 'text' },
                { key: 'desc', label: 'Описание', type: 'longtext' },
                { key: 'hint', label: 'Бейдж/подпись', type: 'text' },
              ],
            },
          },
        ],
      },
      {
        label: 'CTA и подвал страницы',
        fields: [
          { key: 'ctaLabel', label: 'CTA — подпись', type: 'text' },
          { key: 'ctaHref', label: 'CTA — ссылка', type: 'url' },
          { key: 'footerNote', label: 'Текст под каталогом', type: 'longtext' },
          { key: 'footerContactsLabel', label: 'Подпись ссылки на контакты', type: 'text' },
          { key: 'footerContactsHref', label: 'Ссылка на контакты', type: 'url' },
        ],
      },
      {
        label: 'SEO',
        fields: [
          { key: 'title', label: 'Title (вкладка)', type: 'text' },
          { key: 'description', label: 'Description', type: 'longtext' },
        ],
      },
    ],
  },
  'site/thank-you': { title: 'Страница «Спасибо»', groups: [{ label: 'Контент', fields: [] }], dynamic: true },

  'site/privacy': {
    title: 'Политика обработки ПДн',
    groups: [
      {
        label: 'Шапка',
        fields: [
          { key: 'title', label: 'Заголовок', type: 'text' },
          { key: 'description', label: 'SEO-описание', type: 'longtext' },
          { key: 'updated', label: 'Дата редакции (YYYY-MM-DD)', type: 'text' },
          { key: 'intro', label: 'Вступление', type: 'longtext' },
        ],
      },
      {
        label: 'Разделы политики',
        fields: [
          {
            key: 'sections',
            label: 'Разделы',
            type: 'list',
            itemSchema: {
              fields: [
                { key: 'heading', label: 'Заголовок раздела', type: 'text' },
                { key: 'text', label: 'Текст', type: 'longtext' },
              ],
            },
          },
        ],
      },
    ],
  },

  // news / portfolio items use a simple shared schema
  'news/__item__': {
    title: 'Новость',
    bodyEditor: true,
    groups: [
      { label: 'Поля', fields: [
        { key: 'title', label: 'Заголовок', type: 'text' },
        { key: 'date', label: 'Дата (YYYY-MM-DD)', type: 'text' },
        { key: 'tag', label: 'Тег', type: 'text' },
        { key: 'excerpt', label: 'Краткое описание', type: 'longtext' },
        { key: 'image', label: 'Изображение', type: 'image' },
      ]},
    ],
  },
  'portfolio/__item__': {
    title: 'Проект',
    bodyEditor: true,
    groups: [
      { label: 'Поля', fields: [
        { key: 'title', label: 'Название', type: 'text' },
        { key: 'sector', label: 'Сектор', type: 'text' },
        { key: 'desc', label: 'Описание', type: 'longtext' },
        { key: 'tags', label: 'Теги', type: 'string-list' },
        { key: 'image', label: 'Изображение', type: 'image' },
        { key: 'date', label: 'Дата', type: 'text' },
      ]},
    ],
  },
};

export function schemaFor(collection, slug) {
  const id = `${collection}/${slug}`;
  if (SCHEMAS[id]) return SCHEMAS[id];
  if (SCHEMAS[`${collection}/__item__`]) return SCHEMAS[`${collection}/__item__`];
  return null;
}
