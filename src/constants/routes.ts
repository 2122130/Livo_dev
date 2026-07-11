export const ROUTES = {
  MAIN_MENU: {
    path: '/',
    title: 'メインメニュー'
  },
  BUKKEN_ICHIRAN: {
    path: '/bw0200-bukken-ichiran',
    title: '物件一覧'
  },
  BUKKEN_TOUROKU: {
    path: '/bw0210-bukken-touroku',
    title: '物件情報 登録' 
  },
  HEYA_ICHIRAN: {
    path: '/bw0300-heya-ichiran',
    title: '部屋一覧'
  },
  HEYA_TOUROKU: {
    path: '/bw0310-heya-touroku',
    title: '部屋情報 登録'
  },
  TAIOU_ICHIRAN: {
    path: '/bw0500-taiou-ichiran',
    title: '対応一覧'
  },
  TAIOU_TOUROKU: {
    path: '/bw0510-taiou-touroku',
    title: '対応情報 登録'
  },
} as const;

export const PROPERTY_TYPES = {
  MANSION: 'マンション',
  APARTMENT: 'アパート',
  HOUSE: '戸建て',
  OTHER: 'その他',
} as const;
export const PROPERTY_TYPE_LIST = Object.values(PROPERTY_TYPES);

export const MANAGEMENT_TYPES = {
  JISHA: '自社',
  TASHA: '他社',
} as const;
export const MANAGEMENT_TYPE_LIST = Object.values(MANAGEMENT_TYPES);

export const ROOM_STATUS = {
  VACANT: '空室',
  OCCUPIED: '入居中',
  PREPARING: '準備中',
} as const;
export const ROOM_STATUS_LIST = Object.values(ROOM_STATUS);

// ステータス等の定数もあわせて定義しておくと便利です
export const TAIOU_STATUS = {
  MITAIOU: '未対応',
  KANRYOU: '完了',
} as const;

export const TAIOU_CATEGORY = {
  SHUZEN: '修繕',
  KUJOU: '苦情',
  YOUBOU: '要望',
  SONOTA: 'その他',
} as const;