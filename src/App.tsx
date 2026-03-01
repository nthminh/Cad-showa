import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Clock, 
  FileCheck, 
  Files, 
  TrendingUp,
  AlertCircle,
  Menu,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Users,
  Award,
  Target,
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { Sidebar } from './components/Sidebar';
import { StatCard } from './components/StatCard';
import { TaskTable } from './components/TaskTable';
import { DrawingViewer } from './components/DrawingViewer';
import { TaskForm } from './components/TaskForm';
import { EngineerList } from './components/EngineerList';
import { SalaryPage } from './components/SalaryPage';
import { ReportsPage } from './components/ReportsPage';
import { ChatPage } from './components/ChatPage';
import { BulletinBoardPage } from './components/BulletinBoardPage';
import { ChatNotificationBanner } from './components/ChatNotificationBanner';
import { LoginGate } from './components/LoginGate';
import { SettingsPage } from './components/SettingsPage';
import { InternalCalendarPage } from './components/InternalCalendarPage';
import { OrgChartPage } from './components/OrgChartPage';
import { db, isFirebaseConfigured } from './lib/firebase';
import { collection, query, orderBy, onSnapshot, where, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { Task, Engineer } from './types/database.types';
import { isAuthenticated, getCurrentUser, logout } from './lib/auth';
import { type UserRole, getPermissions, ROLE_LABELS } from './lib/permissions';

export default function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const [appUser, setAppUser] = useState(getCurrentUser());
  const [activeTab, setActiveTab] = useState('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mentionCount, setMentionCount] = useState(0);
  const [taskMentionCount, setTaskMentionCount] = useState(0);
  const [bulletinMentionCount, setBulletinMentionCount] = useState(0);
  const [calendarMentionCount, setCalendarMentionCount] = useState(0);
  const [taskMentionNotifications, setTaskMentionNotifications] = useState<{ id: string; messageId: string; sourceTitle: string; mentionerName: string }[]>([]);
  const [bulletinMentionNotifications, setBulletinMentionNotifications] = useState<{ id: string; messageId: string; sourceTitle: string; mentionerName: string }[]>([]);
  const [calendarMentionNotifications, setCalendarMentionNotifications] = useState<{ id: string; messageId: string; sourceTitle: string; mentionerName: string; eventDate?: string }[]>([]);
  const [newChatMessageCount, setNewChatMessageCount] = useState(0);
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [lastChatVisit, setLastChatVisit] = useState<number>(() => {
    const stored = localStorage.getItem('lastChatVisit');
    return stored ? parseInt(stored, 10) : Date.now();
  });

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setError("Firebase is not configured. Please set up your environment variables.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, "tasks"), orderBy("created_at", "desc"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const tasksData: Task[] = [];
      querySnapshot.forEach((doc) => {
        tasksData.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(tasksData);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching tasks from Firebase:", err);
      setError("Không thể kết nối với Firebase. Vui lòng kiểm tra cấu hình và biến môi trường của bạn.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to user's engineer profile photo in real-time
  useEffect(() => {
    if (!db || !appUser) return;
    const q = query(collection(db, 'engineers'), where('full_name', '==', appUser.displayName));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const photoUrl = snap.docs[0].data().photo_url as string | null;
        setUserPhotoUrl(photoUrl ?? null);
      } else {
        setUserPhotoUrl(null);
      }
    }, () => { /* ignore errors */ });
    return () => unsub();
  }, [appUser?.displayName]);

  // Subscribe to unacknowledged @mention notifications for the current user (for sidebar badges)
  useEffect(() => {
    if (!db || !appUser) return;
    const q = query(
      collection(db, 'mention_notifications'),
      where('mentionedUsername', '==', appUser.username),
      where('acknowledged', '==', false),
    );
    const unsub = onSnapshot(q, (snap) => {
      type NotifDoc = { id: string; source?: string; messageId: string; sourceTitle: string; mentionerName: string; eventDate?: string };
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotifDoc));
      setMentionCount(docs.filter((d) => !d.source || d.source === 'chat').length);
      setTaskMentionCount(docs.filter((d) => d.source === 'task').length);
      setBulletinMentionCount(docs.filter((d) => d.source === 'bulletin').length);
      setCalendarMentionCount(docs.filter((d) => d.source === 'calendar').length);
      setTaskMentionNotifications(
        docs.filter((d) => d.source === 'task')
          .map(({ id, messageId, sourceTitle, mentionerName }) => ({ id, messageId, sourceTitle, mentionerName })),
      );
      setBulletinMentionNotifications(
        docs.filter((d) => d.source === 'bulletin')
          .map(({ id, messageId, sourceTitle, mentionerName }) => ({ id, messageId, sourceTitle, mentionerName })),
      );
      setCalendarMentionNotifications(
        docs.filter((d) => d.source === 'calendar')
          .map(({ id, messageId, sourceTitle, mentionerName, eventDate }) => ({ id, messageId, sourceTitle, mentionerName, eventDate })),
      );
    });
    return () => unsub();
  }, [appUser?.username]);

  // Update app icon badge count using the Web App Badging API.
  // On Android, the badge API must be driven from the service worker context
  // (self.setAppBadge on ServiceWorkerGlobalScope), so we post a SET_BADGE
  // message to the active service worker in addition to calling
  // navigator.setAppBadge() directly (which covers desktop browsers).
  useEffect(() => {
    const totalBadge = (mentionCount ?? 0) + (taskMentionCount ?? 0) + (bulletinMentionCount ?? 0) + (calendarMentionCount ?? 0) + (newChatMessageCount ?? 0);
    if ('setAppBadge' in navigator) {
      if (totalBadge > 0) {
        navigator.setAppBadge(totalBadge).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    }
    // Relay to service worker so Android PWA can update the badge via
    // self.navigator.setAppBadge() in the service worker scope.
    // Use navigator.serviceWorker.ready so we reach the active SW even when
    // the controller reference is still null on the first page load.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          registration.active?.postMessage({ type: 'SET_BADGE', count: totalBadge });
        })
        .catch(() => {});
    }
  }, [mentionCount, taskMentionCount, bulletinMentionCount, calendarMentionCount, newChatMessageCount]);

  // When user navigates to chat, mark all messages as read
  useEffect(() => {
    if (activeTab === 'chat') {
      const now = Date.now();
      setLastChatVisit(now);
      localStorage.setItem('lastChatVisit', String(now));
      setNewChatMessageCount(0);
    }
  }, [activeTab]);

  // Subscribe to new chat messages from others since last chat visit (for cross-page banner).
  useEffect(() => {
    if (!db || !appUser || activeTab === 'chat') return;
    const q = query(
      collection(db, 'chat_messages'),
      where('createdAt', '>', Timestamp.fromMillis(lastChatVisit)),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const count = snap.docs.filter((d) => d.data().username !== appUser.username).length;
      setNewChatMessageCount(count);
    });
    return () => unsub();
  }, [appUser?.username, activeTab, lastChatVisit]);

  const fetchTasks = () => {};

  const acknowledgeCalendarNotification = async (id: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'mention_notifications', id), { acknowledged: true });
    } catch (e) {
      console.error(`Failed to acknowledge calendar notification ${id}:`, e);
    }
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Hoàn thành').length;
  const inProgressTasks = tasks.filter(t => t.status === 'Đang làm').length;
  const pendingApprovalTasks = tasks.filter(t => t.status === 'Chờ duyệt').length;
  const cancelledTasks = tasks.filter(t => t.status === 'Đã hủy').length;
  const pausedTasks = tasks.filter(t => t.status === 'Tạm hoãn').length;
  const totalActualHours = tasks.reduce((acc, t) => acc + t.actual_hours, 0);
  const totalTargetHours = tasks.reduce((acc, t) => acc + t.target_hours, 0);
  const avgProductivity = totalActualHours > 0 ? (totalTargetHours / totalActualHours) * 100 : 0;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const now = new Date();
  const overdueTaskCount = tasks.filter(
    t => t.deadline && new Date(t.deadline) < now && t.status !== 'Hoàn thành'
  ).length;

  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const deadlineSoonTasks = tasks.filter(
    t =>
      t.status === 'Đang làm' &&
      t.deadline &&
      new Date(t.deadline) >= now &&
      new Date(t.deadline) <= oneWeekFromNow &&
      t.engineer_name === (appUser?.displayName ?? '')
  );

  const chartData = tasks.slice(0, 7).map(t => ({
    name: t.drawing_name.length > 10 ? t.drawing_name.slice(0, 10) + '...' : t.drawing_name,
    productivity: t.actual_hours > 0 ? (t.target_hours / t.actual_hours) * 100 : 0,
    fullName: t.drawing_name
  }));

  // Status distribution for pie chart
  const statusData = [
    { name: 'Hoàn thành', value: completedTasks, fill: '#10b981' },
    { name: 'Đang làm', value: inProgressTasks, fill: '#3b82f6' },
    { name: 'Chờ duyệt', value: pendingApprovalTasks, fill: '#f59e0b' },
    { name: 'Tạm hoãn', value: pausedTasks, fill: '#64748b' },
    { name: 'Đã hủy', value: cancelledTasks, fill: '#f43f5e' },
  ].filter(d => d.value > 0);

  // Per-engineer task counts
  const engineerTaskMap: Record<string, { completed: number; active: number; total: number }> = {};
  tasks.forEach(t => {
    if (!t.engineer_name) return;
    if (!engineerTaskMap[t.engineer_name]) {
      engineerTaskMap[t.engineer_name] = { completed: 0, active: 0, total: 0 };
    }
    engineerTaskMap[t.engineer_name].total++;
    if (t.status === 'Hoàn thành') engineerTaskMap[t.engineer_name].completed++;
    else if (t.status === 'Đang làm') engineerTaskMap[t.engineer_name].active++;
  });
  const engineerChartData = Object.entries(engineerTaskMap)
    .map(([name, d]) => ({
      name: name.length > 12 ? name.slice(0, 12) + '…' : name,
      Hoàn_thành: d.completed,
      Đang_làm: d.active,
      total: d.total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Recent overdue tasks
  const overdueTasks = tasks
    .filter(t => t.deadline && new Date(t.deadline) < now && t.status !== 'Hoàn thành')
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5);

  const role: UserRole = appUser?.role ?? 'engineer';
  const perms = getPermissions(role);

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
    setAppUser(null);
    setMentionCount(0);
    setTaskMentionCount(0);
    setBulletinMentionCount(0);
    setCalendarMentionCount(0);
    setUserPhotoUrl(null);
    setTaskMentionNotifications([]);
    setBulletinMentionNotifications([]);
    setCalendarMentionNotifications([]);
    setShowAvatarMenu(false);
  };

  const sidebarUser = appUser
    ? { username: appUser.username, displayName: appUser.displayName, role: appUser.role, photoUrl: userPhotoUrl }
    : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {!authenticated && (
        <LoginGate onAuthenticated={() => {
          setAuthenticated(true);
          setAppUser(getCurrentUser());
        }} />
      )}
      {authenticated && (
      <>
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        userRole={role}
        onLogout={handleLogout}
        mentionCount={mentionCount}
        taskMentionCount={taskMentionCount}
        bulletinMentionCount={bulletinMentionCount}
        calendarMentionCount={calendarMentionCount}
        deadlineSoonCount={deadlineSoonTasks.length}
        appUser={sidebarUser}
      />

      <div className="lg:pl-64 flex-1 flex flex-col">
        <header className="flex items-center justify-between p-4 lg:p-8 bg-slate-50/80 backdrop-blur-sm sticky top-0 z-20 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden text-slate-600 hover:text-slate-900"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <div>
              <h2 className="text-xl lg:text-3xl font-bold text-slate-900 tracking-tight">
                {activeTab === 'tasks' ? 'Quản lý công việc' :
                 activeTab === 'engineers' ? 'Danh sách nhân viên' :
                 activeTab === 'salary' ? 'Tính lương' :
                 activeTab === 'chat' ? 'Chat nội bộ' :
                 activeTab === 'bulletin' ? 'Bảng tin' :
                 activeTab === 'calendar' ? 'Lịch nội bộ' :
                 activeTab === 'orgchart' ? 'Sơ đồ phòng ban' :
                 activeTab === 'settings' ? 'Cài đặt' :
                 'Báo cáo'}
              </h2>
              <p className="text-slate-500 mt-1 text-xs lg:text-base hidden sm:block">
                {activeTab === 'tasks'
                  ? 'Danh sách chi tiết các công việc và tiến độ.'
                  : activeTab === 'engineers'
                  ? 'Quản lý thông tin công ty và nhân viên.'
                  : activeTab === 'salary'
                  ? 'Quản lý lương căn bản và lương theo công việc hoàn thành.'
                  : activeTab === 'chat'
                  ? 'Nhắn tin và trao đổi với các thành viên trong nhóm.'
                  : activeTab === 'bulletin'
                  ? 'Cập nhật tin tức và thông báo của công ty.'
                  : activeTab === 'calendar'
                  ? 'Lịch nội bộ và các sự kiện quan trọng của đội.'
                  : activeTab === 'orgchart'
                  ? 'Cấu trúc tổ chức và nhân sự theo phòng ban.'
                  : activeTab === 'settings'
                   ? 'Quản lý người dùng và phân quyền truy cập.'
                   : 'Tổng quan và thống kê hiệu suất toàn đội.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {appUser && (
              <div className="relative">
                <button
                  className="flex items-center gap-2 focus:outline-none"
                  onClick={() => setShowAvatarMenu(v => !v)}
                  title="Tùy chọn tài khoản"
                >
                  <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
                    {userPhotoUrl ? (
                      <img src={userPhotoUrl} alt={appUser.displayName} className="w-full h-full object-cover" />
                    ) : (
                      appUser.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-slate-700 leading-tight">{appUser.displayName}</p>
                    <p className="text-xs text-slate-500 leading-tight">{ROLE_LABELS[role]}</p>
                  </div>
                </button>
                {showAvatarMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowAvatarMenu(false)} onKeyDown={(e) => e.key === 'Escape' && setShowAvatarMenu(false)} />
                    <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg border border-slate-200 z-40 overflow-hidden">
                      <button
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                        onClick={handleLogout}
                        aria-label="Logout"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Đăng xuất
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {activeTab === 'engineers' && perms.canViewEngineers ? (
            <EngineerList canManage={perms.canManageEngineers} />
          ) : activeTab === 'salary' && perms.canViewSalary ? (
            <SalaryPage canEditSalary={perms.canEditSalary} />
          ) : activeTab === 'reports' && perms.canViewReports ? (
            <div className="space-y-6">
              {/* Primary stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <StatCard 
                  title="Tổng số công việc" 
                  value={totalTasks} 
                  icon={Files} 
                  color="blue"
                />
                <StatCard 
                  title="Hoàn thành" 
                  value={completedTasks} 
                  icon={FileCheck} 
                  color="emerald"
                />
                <StatCard 
                  title="Đang thực hiện" 
                  value={inProgressTasks} 
                  icon={Clock} 
                  color="amber"
                />
                <StatCard 
                  title="Năng suất TB" 
                  value={`${avgProductivity.toFixed(1)}%`} 
                  icon={TrendingUp} 
                  color={avgProductivity > 100 ? 'emerald' : avgProductivity < 80 ? 'rose' : 'blue'}
                />
              </div>

              {/* Secondary stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                    <Target size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Tỷ lệ hoàn thành</p>
                    <p className="text-lg font-bold text-slate-900">{completionRate.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                    <Clock size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Tổng giờ thực tế</p>
                    <p className="text-lg font-bold text-slate-900">{totalActualHours.toFixed(1)}h</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                    <PauseCircle size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Chờ duyệt</p>
                    <p className="text-lg font-bold text-slate-900">{pendingApprovalTasks}</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${overdueTaskCount > 0 ? 'bg-rose-50 border border-rose-100' : 'bg-slate-50 border border-slate-100'}`}>
                    <AlertCircle size={18} className={overdueTaskCount > 0 ? 'text-rose-600' : 'text-slate-400'} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Quá hạn</p>
                    <p className={`text-lg font-bold ${overdueTaskCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{overdueTaskCount}</p>
                  </div>
                </div>
              </div>

              {overdueTaskCount > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
                  <AlertCircle size={20} className="flex-shrink-0" />
                  <p className="text-sm font-medium">
                    Có <span className="font-bold">{overdueTaskCount}</span> công việc đã quá hạn và chưa hoàn thành.
                    <button
                      onClick={() => setActiveTab('tasks')}
                      className="ml-2 underline font-semibold hover:text-rose-900 transition-colors"
                    >
                      Xem ngay →
                    </button>
                  </p>
                </div>
              )}

              {/* Detailed reports */}
              <ReportsPage />
            </div>
          ) : activeTab === 'chat' ? (
            <ChatPage />
          ) : activeTab === 'bulletin' ? (
            <BulletinBoardPage userRole={role} mentionCount={mentionCount} bulletinMentionCount={bulletinMentionCount} newMessageCount={newChatMessageCount} onNavigateToChat={() => setActiveTab('chat')} bulletinMentionNotifications={bulletinMentionNotifications} />
          ) : activeTab === 'calendar' ? (
            <InternalCalendarPage
              calendarMentionNotifications={calendarMentionNotifications}
              onAcknowledgeNotification={acknowledgeCalendarNotification}
            />
          ) : activeTab === 'orgchart' ? (
            <OrgChartPage tasks={tasks} />
          ) : activeTab === 'settings' && perms.canViewSettings ? (
            <SettingsPage />
          ) : (
            <div className="space-y-6">
              <ChatNotificationBanner
                mentionCount={mentionCount}
                newMessageCount={newChatMessageCount}
                onNavigateToChat={() => setActiveTab('chat')}
                onDismissNewMessages={() => {
                  const now = Date.now();
                  setLastChatVisit(now);
                  localStorage.setItem('lastChatVisit', String(now));
                  setNewChatMessageCount(0);
                }}
              />
              <TaskTable 
                tasks={tasks} 
                onRefresh={fetchTasks} 
                onViewDrawing={(url) => setViewerUrl(url)}
                canEdit={perms.canEditTask}
                canDelete={perms.canDeleteTask}
                canAddTask={perms.canAddTask}
                onAddTask={() => setShowTaskForm(true)}
                taskMentionNotifications={taskMentionNotifications}
                deadlineSoonTasks={deadlineSoonTasks}
              />
            </div>
          )}
        </main>
      </div>

      {viewerUrl && (
        <DrawingViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
      )}

      {showTaskForm && (
        <TaskForm onClose={() => setShowTaskForm(false)} onSuccess={() => setShowTaskForm(false)} />
      )}
      </>
      )}
    </div>
  );
}
