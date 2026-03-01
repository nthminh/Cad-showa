import React from 'react';
import { ClipboardList, X, Users, DollarSign, BarChart3, LogOut, MessageCircle, Newspaper, Settings, CalendarDays, Network } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type UserRole, getPermissions, ROLE_LABELS } from '../lib/permissions';
import { logout } from '../lib/auth';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarUser {
  username: string;
  displayName: string;
  role: UserRole;
  photoUrl?: string | null;
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  userRole: UserRole;
  onLogout: () => void;
  mentionCount?: number;
  taskMentionCount?: number;
  bulletinMentionCount?: number;
  calendarMentionCount?: number;
  deadlineSoonCount?: number;
  appUser?: SidebarUser | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen, userRole, onLogout, mentionCount = 0, taskMentionCount = 0, bulletinMentionCount = 0, calendarMentionCount = 0, deadlineSoonCount = 0, appUser }) => {
  const perms = getPermissions(userRole);

  const allMenuItems = [
    { id: 'tasks', label: 'Quản lý công việc', icon: ClipboardList, visible: true },
    { id: 'engineers', label: 'Danh sách nhân viên', icon: Users, visible: perms.canViewEngineers },
    { id: 'salary', label: 'Tính lương', icon: DollarSign, visible: perms.canViewSalary },
    { id: 'reports', label: 'Báo cáo', icon: BarChart3, visible: perms.canViewReports },
    { id: 'bulletin', label: 'Bảng tin', icon: Newspaper, visible: true },
    { id: 'chat', label: 'Chat nội bộ', icon: MessageCircle, visible: true },
    { id: 'calendar', label: 'Lịch nội bộ', icon: CalendarDays, visible: true },
    { id: 'orgchart', label: 'Sơ đồ phòng ban', icon: Network, visible: true },
    { id: 'settings', label: 'Cài đặt', icon: Settings, visible: perms.canViewSettings },
  ];

  const menuItems = allMenuItems.filter((item) => item.visible);

  return (
    <>
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        ></div>
      )}

      <aside 
        className={cn(
          "fixed top-0 left-0 z-40 w-64 h-screen bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800",
          "transition-transform duration-300 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 40 40" className="rounded-lg flex-shrink-0" role="img" aria-label="DG Logo">
              <rect width="40" height="40" rx="8" fill="white" />
              <text x="2" y="30" fontFamily="Arial Black, sans-serif" fontSize="28" fontWeight="900" fill="#dc2626">D</text>
              <text x="16" y="30" fontFamily="Arial Black, sans-serif" fontSize="28" fontWeight="900" fill="#111827">G</text>
            </svg>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">DG</h1>
              <p className="text-xs text-slate-500">Productivity Manager</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-500 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                activeTab === item.id
                  ? "bg-emerald-500/10 text-emerald-400 font-medium"
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon 
                size={20} 
                className={cn(
                  "transition-colors",
                  activeTab === item.id ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"
                )} 
              />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === 'chat' && mentionCount > 0 && (
                <span className="min-w-[20px] h-5 flex items-center justify-center bg-rose-500 text-white text-xs font-bold rounded-full px-1.5">
                  {mentionCount > 99 ? '99+' : mentionCount}
                </span>
              )}
              {item.id === 'tasks' && taskMentionCount > 0 && (
                <span className="min-w-[20px] h-5 flex items-center justify-center bg-rose-500 text-white text-xs font-bold rounded-full px-1.5">
                  {taskMentionCount > 99 ? '99+' : taskMentionCount}
                </span>
              )}
              {item.id === 'tasks' && deadlineSoonCount > 0 && (
                <span className="min-w-[20px] h-5 flex items-center justify-center bg-amber-500 text-white text-xs font-bold rounded-full px-1.5" title="Công việc sắp đến hạn">
                  {deadlineSoonCount > 99 ? '99+' : deadlineSoonCount}
                </span>
              )}
              {item.id === 'bulletin' && bulletinMentionCount > 0 && (
                <span className="min-w-[20px] h-5 flex items-center justify-center bg-rose-500 text-white text-xs font-bold rounded-full px-1.5">
                  {bulletinMentionCount > 99 ? '99+' : bulletinMentionCount}
                </span>
              )}
              {item.id === 'calendar' && calendarMentionCount > 0 && (
                <span className="min-w-[20px] h-5 flex items-center justify-center bg-rose-500 text-white text-xs font-bold rounded-full px-1.5">
                  {calendarMentionCount > 99 ? '99+' : calendarMentionCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          {appUser && (
            <div className="flex items-center gap-3 px-3 py-2.5 mb-2 bg-slate-800 rounded-xl">
              <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden bg-emerald-600 flex items-center justify-center">
                {appUser.photoUrl ? (
                  <img src={appUser.photoUrl} alt={appUser.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-sm font-bold">
                    {appUser.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white leading-tight truncate">{appUser.displayName}</p>
                <p className="text-xs text-slate-400 leading-tight">{ROLE_LABELS[appUser.role]}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => { logout(); onLogout(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-slate-800 hover:text-white text-slate-400 group"
          >
            <LogOut size={20} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
            Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
};
