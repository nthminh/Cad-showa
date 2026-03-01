export type Language = 'vi' | 'ja';

export const LANGUAGES: Record<Language, { label: string; flag: string }> = {
  vi: { label: 'Tiếng Việt', flag: '🇻🇳' },
  ja: { label: '日本語', flag: '🇯🇵' },
};

const translations = {
  vi: {
    // Sidebar navigation
    nav_tasks: 'Quản lý công việc',
    nav_engineers: 'Danh sách nhân viên',
    nav_salary: 'Tính lương',
    nav_reports: 'Báo cáo',
    nav_bulletin: 'Bảng tin',
    nav_chat: 'Chat nội bộ',
    nav_calendar: 'Lịch nội bộ',
    nav_orgchart: 'Sơ đồ phòng ban',
    nav_settings: 'Cài đặt',
    nav_logout: 'Đăng xuất',

    // Header titles
    header_tasks: 'Quản lý công việc',
    header_engineers: 'Danh sách nhân viên',
    header_salary: 'Tính lương',
    header_chat: 'Chat nội bộ',
    header_bulletin: 'Bảng tin',
    header_calendar: 'Lịch nội bộ',
    header_orgchart: 'Sơ đồ phòng ban',
    header_settings: 'Cài đặt',
    header_reports: 'Báo cáo',

    // Header subtitles
    subtitle_tasks: 'Danh sách chi tiết các công việc và tiến độ.',
    subtitle_engineers: 'Quản lý thông tin công ty và nhân viên.',
    subtitle_salary: 'Quản lý lương căn bản và lương theo công việc hoàn thành.',
    subtitle_chat: 'Nhắn tin và trao đổi với các thành viên trong nhóm.',
    subtitle_bulletin: 'Cập nhật tin tức và thông báo của công ty.',
    subtitle_calendar: 'Lịch nội bộ và các sự kiện quan trọng của đội.',
    subtitle_orgchart: 'Cấu trúc tổ chức và nhân sự theo phòng ban.',
    subtitle_settings: 'Quản lý người dùng và phân quyền truy cập.',
    subtitle_reports: 'Tổng quan và thống kê hiệu suất toàn đội.',

    // Role labels
    role_admin: 'Quản trị viên',
    role_manager: 'Quản lý',
    role_engineer: 'Kỹ sư',
    role_employee: 'Nhân viên',

    // Permission labels
    perm_canAddTask: 'Thêm Task',
    perm_canEditTask: 'Sửa Task',
    perm_canDeleteTask: 'Xóa Task',
    perm_canViewEngineers: 'Xem danh sách kỹ sư',
    perm_canManageEngineers: 'Quản lý kỹ sư',
    perm_canViewSalary: 'Xem trang lương',
    perm_canEditSalary: 'Chỉnh sửa lương',
    perm_canViewReports: 'Xem báo cáo',
    perm_canViewSettings: 'Xem cài đặt',

    // Language switcher
    language: 'Ngôn ngữ',
  },

  ja: {
    // Sidebar navigation
    nav_tasks: 'タスク管理',
    nav_engineers: '従業員リスト',
    nav_salary: '給与計算',
    nav_reports: 'レポート',
    nav_bulletin: '掲示板',
    nav_chat: '社内チャット',
    nav_calendar: '社内カレンダー',
    nav_orgchart: '組織図',
    nav_settings: '設定',
    nav_logout: 'ログアウト',

    // Header titles
    header_tasks: 'タスク管理',
    header_engineers: '従業員リスト',
    header_salary: '給与計算',
    header_chat: '社内チャット',
    header_bulletin: '掲示板',
    header_calendar: '社内カレンダー',
    header_orgchart: '組織図',
    header_settings: '設定',
    header_reports: 'レポート',

    // Header subtitles
    subtitle_tasks: 'タスクの詳細リストと進捗状況。',
    subtitle_engineers: '会社と従業員の情報を管理します。',
    subtitle_salary: '基本給と完了タスクに基づく給与を管理します。',
    subtitle_chat: 'チームメンバーとメッセージを送受信します。',
    subtitle_bulletin: '会社のニュースとお知らせを更新します。',
    subtitle_calendar: '社内カレンダーとチームの重要なイベント。',
    subtitle_orgchart: '部門別の組織構造と人員。',
    subtitle_settings: 'ユーザー管理とアクセス権の設定。',
    subtitle_reports: 'チーム全体のパフォーマンスの概要と統計。',

    // Role labels
    role_admin: '管理者',
    role_manager: 'マネージャー',
    role_engineer: 'エンジニア',
    role_employee: '従業員',

    // Permission labels
    perm_canAddTask: 'タスク追加',
    perm_canEditTask: 'タスク編集',
    perm_canDeleteTask: 'タスク削除',
    perm_canViewEngineers: 'エンジニアリスト閲覧',
    perm_canManageEngineers: 'エンジニア管理',
    perm_canViewSalary: '給与ページ閲覧',
    perm_canEditSalary: '給与編集',
    perm_canViewReports: 'レポート閲覧',
    perm_canViewSettings: '設定閲覧',

    // Language switcher
    language: '言語',
  },
} as const;

export type TranslationKey = keyof typeof translations.vi;

export function getTranslation(lang: Language, key: TranslationKey): string {
  return translations[lang][key] ?? translations.vi[key] ?? key;
}
