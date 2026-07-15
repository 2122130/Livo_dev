// --- 1. ルーティング定義（これはこのままでOK） ---
export const ROUTES = {
  LOGIN: { path: '/bw0001-login', title: 'ログイン' },
  MAIN_MENU: { path: '/', title: 'メインメニュー' },
  BUKKEN_ICHIRAN: { path: '/bw0200-bukken-ichiran', title: '物件一覧' },
  BUKKEN_TOUROKU: { path: '/bw0210-bukken-touroku', title: '物件情報 登録' },
  HEYA_ICHIRAN: { path: '/bw0300-heya-ichiran', title: '部屋一覧' },
  HEYA_TOUROKU: { path: '/bw0310-heya-touroku', title: '部屋情報 登録' },
  TAIOU_ICHIRAN: { path: '/bw0500-taiou-ichiran', title: '対応一覧' },
  TAIOU_TOUROKU: { path: '/bw0510-taiou-touroku', title: '対応情報 登録' },
} as const;

export const BUKKENTAB_CATEGORIES = {
  RENT: 1,
  SALE: 2,
  SUNLIGHT: 3,
} as const;

// --- 2. DBのコード値定義（kubun_idのint型化に対応） ---

// 物件種別 (kubun_type: '010')
export const MUKOU_KBN = {
  無効: 0,
  有効: 1,
} as const;

// 物件種別 (kubun_type: '010')
export const PROPERTY_TYPES = {
  MANSION: 1,   // 'マンション'
  APARTMENT: 2, // 'アパート'
  HOUSE: 3,     // '戸建て'
  TENPO: 4,     // '店舗'
  LAND: 5,      // '土地'
} as const;

// 管理区分 (kubun_type: '020')
export const KANRI_KBN = {
  JISHA: 1, // '自社'
  KANRI: 2, // '管理'
} as const;

// 部屋ステータス (kubun_type: '040')
export const ROOM_STATUS = {
  AKISHITSU: 1, // '空室'
  JUNBICHU: 2,  // '準備中'
  NYUKYUCHU: 3, // '入居中'
} as const;

export const ROOM_STATUS_LIST = [
  ROOM_STATUS.AKISHITSU,
  ROOM_STATUS.JUNBICHU,
  ROOM_STATUS.NYUKYUCHU,
] as const;

// 対応状況区分 (kubun_type: '060')
export const TAIOU_STATUS = {
  MITAIOU: 1,   // '未処理'
  SHORICHU: 2,  // '処理中'
  KANRYOU: 3,   // '完了'
} as const;

// 問い合わせ種別 (kubun_type: '050')
export const TAIOU_CATEGORY = {
  SHUZEN: 1,  // '修繕'
  KUJOU: 2,   // '苦情'
  YOUBOU: 3,  // '要望'
  SONOTA: 9,  // 'その他'
} as const;

export type BukkenTabCategory = typeof BUKKENTAB_CATEGORIES[keyof typeof BUKKENTAB_CATEGORIES];
export const BUKKENTAB_CONFIG: Record<BukkenTabCategory, { label: string, color: string }> = {
  [BUKKENTAB_CATEGORIES.RENT]: { label: '賃貸', color: 'emerald' },
  [BUKKENTAB_CATEGORIES.SALE]: { label: '売買', color: 'blue' },
  [BUKKENTAB_CATEGORIES.SUNLIGHT]: { label: '太陽光', color: 'amber' },
}

export const PROPERTY_TYPE_LABELS: Record<number, string> = {
  [PROPERTY_TYPES.MANSION]: 'マンション',
  [PROPERTY_TYPES.APARTMENT]: 'アパート',
  [PROPERTY_TYPES.HOUSE]: '戸建て',
  [PROPERTY_TYPES.TENPO]: '店舗',
  [PROPERTY_TYPES.LAND]: '土地',
};

export const KANRI_KBN_LABELS: Record<number, string> = {
  [KANRI_KBN.JISHA]: '自社',
  [KANRI_KBN.KANRI]: '管理',
};

export const ROOM_STATUS_LABELS: Record<number, string> = {
  [ROOM_STATUS.AKISHITSU]: '空室',
  [ROOM_STATUS.JUNBICHU]: '準備中',
  [ROOM_STATUS.NYUKYUCHU]: '入居中',
};

export const TAIOU_STATUS_LABELS: Record<number, string> = {
  [TAIOU_STATUS.MITAIOU]: '未処理',
  [TAIOU_STATUS.SHORICHU]: '処理中',
  [TAIOU_STATUS.KANRYOU]: '完了',
};

export const TAIOU_CATEGORY_LABELS: Record<number, string> = {
  [TAIOU_CATEGORY.SHUZEN]: '修繕',
  [TAIOU_CATEGORY.KUJOU]: '苦情',
  [TAIOU_CATEGORY.YOUBOU]: '要望',
  [TAIOU_CATEGORY.SONOTA]: 'その他',
};