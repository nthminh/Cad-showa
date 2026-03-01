import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ExternalLink, Eye, MoreVertical, Star, Download, Search, Filter, FileDown, FileSpreadsheet, X, MessageSquare, ChevronRight, ChevronDown, Plus, Bell, CheckCircle2, AlertCircle } from 'lucide-react';
import ExcelJS from 'exceljs';
import { Task } from '../types/database.types';
import { TaskContextMenu } from './TaskContextMenu';
import { EditTaskForm } from './EditTaskForm';
import { TaskCommentSection } from './TaskCommentSection';
import { db } from '../lib/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';

const COLUMNS = [
  { key: 'drawing_name' as const, label: 'Tên công việc', defaultWidth: 160 },
  { key: 'description' as const, label: 'Thông tin công việc', defaultWidth: 200 },
  { key: 'engineer_name' as const, label: 'Người phụ trách', defaultWidth: 130 },
  { key: 'difficulty' as const, label: 'Độ khó', defaultWidth: 100 },
  { key: 'status' as const, label: 'Trạng thái', defaultWidth: 115 },
  { key: 'deadline' as const, label: 'Hạn chót', defaultWidth: 115 },
  { key: 'productivity' as const, label: 'Năng suất (T/A)', defaultWidth: 135 },
  { key: 'cost' as const, label: 'Giá thành', defaultWidth: 130 },
  { key: 'actual_hours' as const, label: 'Giờ thực tế', defaultWidth: 115 },
  { key: 'drive_link' as const, label: 'Tải về', defaultWidth: 90 },
  { key: 'viewer_link' as const, label: 'Xem bản vẽ', defaultWidth: 105 },
  { key: 'comments' as const, label: 'Bình luận', defaultWidth: 95 },
  { key: 'actions' as const, label: 'Thao tác', defaultWidth: 105 },
];
type ColumnKey = typeof COLUMNS[number]['key'];
type ColWidths = Record<ColumnKey, number>;
const DEFAULT_COL_WIDTHS: ColWidths = Object.fromEntries(
  COLUMNS.map(c => [c.key, c.defaultWidth])
) as ColWidths;

function ActualHoursInput({ task, onRefresh, readOnly }: { task: Task; onRefresh: () => void; readOnly?: boolean }) {
  const [value, setValue] = useState(String(task.actual_hours ?? 0));

  useEffect(() => {
    setValue(String(task.actual_hours ?? 0));
  }, [task.actual_hours]);

  const handleSave = async () => {
    if (!db) return;
    const hours = parseFloat(value) || 0;
    if (hours === task.actual_hours) return;
    try {
      await updateDoc(doc(db, 'tasks', task.id), { actual_hours: hours });
      onRefresh();
    } catch (e) {
      console.error('Error updating actual hours:', e);
    }
  };

  if (readOnly) {
    return <span className="text-sm text-slate-700">{(task.actual_hours ?? 0).toFixed(1)}h</span>;
  }

  return (
    <input
      type="number"
      min="0"
      step="0.5"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
    />
  );
}

interface TaskMentionNotification {
  id: string;
  messageId: string;
  sourceTitle: string;
  mentionerName: string;
}

interface TaskTableProps {
  tasks: Task[];
  onRefresh: () => void;
  onViewDrawing: (link: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canAddTask?: boolean;
  onAddTask?: () => void;
  taskMentionNotifications?: TaskMentionNotification[];
  deadlineSoonTasks?: Task[];
}

function exportTimestamp() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
}

function exportToCSV(tasks: Task[]) {
  const headers = [
    'Tên công việc', 'Thông tin công việc', 'Người phụ trách', 'Độ khó', 'Trạng thái', 'Hạn chót',
    'Giờ mục tiêu', 'Giờ thực tế', 'Năng suất (%)', 'Giá thành (VNĐ)', 'Link Drive', 'Ngày tạo',
  ];
  const rows = tasks.map(t => [
    t.drawing_name,
    t.description ?? '',
    t.engineer_name,
    t.difficulty,
    t.status,
    t.deadline ?? '',
    t.target_hours,
    t.actual_hours.toFixed(1),
    t.actual_hours > 0 ? ((t.target_hours / t.actual_hours) * 100).toFixed(1) : '',
    t.cost ?? '',
    t.drive_link ?? '',
    new Date(t.created_at).toLocaleDateString('vi-VN'),
  ]);
  const csvRows = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const encoded = new TextEncoder().encode(csvRows);
  const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const combined = new Uint8Array(BOM.length + encoded.length);
  combined.set(BOM);
  combined.set(encoded, BOM.length);
  const blob = new Blob([combined], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `congviec-${exportTimestamp()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function exportToExcel(tasks: Task[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CAD Productivity Manager';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Công việc CAD');

  sheet.columns = [
    { header: 'Tên công việc', key: 'drawing_name', width: 28 },
    { header: 'Thông tin công việc', key: 'description', width: 32 },
    { header: 'Người phụ trách', key: 'engineer', width: 18 },
    { header: 'Độ khó', key: 'difficulty', width: 12 },
    { header: 'Trạng thái', key: 'status', width: 16 },
    { header: 'Hạn chót', key: 'deadline', width: 14 },
    { header: 'Giờ mục tiêu', key: 'target_hours', width: 14 },
    { header: 'Giờ thực tế', key: 'actual_hours', width: 13 },
    { header: 'Năng suất (%)', key: 'productivity', width: 15 },
    { header: 'Giá thành (VNĐ)', key: 'cost', width: 20 },
    { header: 'Link Drive', key: 'drive_link', width: 32 },
    { header: 'Ngày tạo', key: 'created_at', width: 14 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 22;

  tasks.forEach((t, index) => {
    const productivity = t.actual_hours > 0
      ? parseFloat(((t.target_hours / t.actual_hours) * 100).toFixed(1))
      : null;
    const row = sheet.addRow({
      drawing_name: t.drawing_name,
      description: t.description ?? '',
      engineer: t.engineer_name,
      difficulty: t.difficulty,
      status: t.status,
      deadline: t.deadline ?? '',
      target_hours: t.target_hours,
      actual_hours: Math.round(t.actual_hours * 10) / 10,
      productivity: productivity,
      cost: t.cost ?? '',
      drive_link: t.drive_link ?? '',
      created_at: new Date(t.created_at).toLocaleDateString('vi-VN'),
    });
    row.alignment = { vertical: 'middle', wrapText: false };
    if (index % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
    }
  });

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `congviec-${exportTimestamp()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const TaskTable: React.FC<TaskTableProps> = ({ tasks, onRefresh, onViewDrawing, canEdit = true, canDelete = true, canAddTask = false, onAddTask, taskMentionNotifications = [], deadlineSoonTasks = [] }) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [commentTaskId, setCommentTaskId] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [filterEngineer, setFilterEngineer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [colWidths, setColWidths] = useState<ColWidths>({ ...DEFAULT_COL_WIDTHS });
  const resizeRef = useRef<{ col: ColumnKey; startX: number; startW: number } | null>(null);
  const [cellTooltip, setCellTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const cellTooltipRef = useRef<HTMLDivElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!cellTooltip) return;
    const close = (e: MouseEvent) => {
      if (cellTooltipRef.current && !cellTooltipRef.current.contains(e.target as Node)) {
        setCellTooltip(null);
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', close), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', close);
    };
  }, [cellTooltip]);

  const showCellTooltip = (e: React.MouseEvent, text: string | undefined | null) => {
    if (!text) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(8, Math.min(rect.left, window.innerWidth - 320));
    const y = rect.bottom + 6;
    setCellTooltip({ text, x, y });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, col: ColumnKey) => {
    e.preventDefault();
    resizeRef.current = { col, startX: e.clientX, startW: colWidths[col] };
    const onMouseMove = (ev: MouseEvent) => {
      const current = resizeRef.current;
      if (!current) return;
      const newWidth = Math.max(60, current.startW + ev.clientX - current.startX);
      setColWidths(prev => ({ ...prev, [current.col]: newWidth }));
    };
    const onMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
    if (!db || tasks.length === 0) return;
    const taskIds = tasks.map((t) => t.id);
    // Firestore `in` query supports up to 30 items; split if needed
    const chunks: string[][] = [];
    for (let i = 0; i < taskIds.length; i += 30) chunks.push(taskIds.slice(i, i + 30));
    const unsubs = chunks.map((chunk) => {
      const q = query(collection(db, 'task_comments'), where('task_id', 'in', chunk));
      return onSnapshot(q, (snapshot) => {
        setCommentCounts((prev) => {
          const updated = { ...prev };
          // Reset counts for tasks in this chunk
          chunk.forEach((id) => { updated[id] = 0; });
          snapshot.docs.forEach((d) => {
            const taskId = d.data().task_id as string;
            updated[taskId] = (updated[taskId] ?? 0) + 1;
          });
          return updated;
        });
      });
    });
    return () => unsubs.forEach((u) => u());
  }, [tasks]);

  const uniqueEngineers = useMemo(
    () => Array.from(new Set(tasks.map(t => t.engineer_name))).sort(),
    [tasks]
  );

  // Group child tasks by parentId for quick lookup
  const childTasksMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (t.parentId) {
        const existing = map.get(t.parentId) ?? [];
        map.set(t.parentId, [...existing, t]);
      }
    });
    return map;
  }, [tasks]);

  // Only show root tasks (parentId is null/undefined) in the main list
  const rootTasks = useMemo(() => tasks.filter(t => !t.parentId), [tasks]);

  const filteredTasks = rootTasks.filter(t => {
    const matchSearch = search === '' || t.drawing_name.toLowerCase().includes(search.toLowerCase());
    const matchEngineer = filterEngineer === '' || t.engineer_name === filterEngineer;
    const matchStatus = filterStatus === '' || t.status === filterStatus;
    return matchSearch && matchEngineer && matchStatus;
  });

  const hasActiveFilters = search !== '' || filterEngineer !== '' || filterStatus !== '';

  const clearFilters = () => {
    setSearch('');
    setFilterEngineer('');
    setFilterStatus('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Đang làm': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Chờ duyệt': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Hoàn thành': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Đã hủy': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Tạm hoãn': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const isInactiveStatus = (status: string) =>
    status === 'Hoàn thành' || status === 'Đã hủy' || status === 'Tạm hoãn';

  const getProductivityColor = (target: number, actual: number) => {
    if (actual === 0) return 'text-slate-400';
    const ratio = (target / actual) * 100;
    if (ratio < 80) return 'text-rose-600 font-bold';
    if (ratio > 100) return 'text-emerald-600 font-bold';
    return 'text-slate-700';
  };

  const acknowledgeTaskNotification = async (id: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'mention_notifications', id), { acknowledged: true });
    } catch (e) {
      console.error(`Failed to acknowledge notification ${id}:`, e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Task mention notifications */}
      {taskMentionNotifications.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Bell size={16} className="text-amber-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-800">Bạn được nhắc đến trong bình luận công việc:</p>
          </div>
          {taskMentionNotifications.map((notif) => (
            <div key={notif.id} className="flex items-center gap-2 bg-white border border-amber-100 rounded-xl px-3 py-2">
              <MessageSquare size={14} className="text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-800 font-medium truncate">{notif.sourceTitle}</span>
                <span className="text-xs text-slate-500 ml-1.5">bởi {notif.mentionerName}</span>
              </div>
              <button
                onClick={() => {
                  setCommentTaskId(notif.messageId);
                  acknowledgeTaskNotification(notif.id);
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
              >
                <MessageSquare size={12} />
                Xem
              </button>
              <button
                onClick={() => acknowledgeTaskNotification(notif.id)}
                title="Đánh dấu đã đọc"
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex-shrink-0"
              >
                <CheckCircle2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Deadline-soon notifications */}
      {deadlineSoonTasks.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Bell size={16} className="text-orange-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-orange-800">
              Bạn có <span className="font-bold">{deadlineSoonTasks.length}</span> công việc sắp đến hạn trong vòng 1 tuần:
            </p>
          </div>
          {deadlineSoonTasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 bg-white border border-orange-100 rounded-xl px-3 py-2">
              <AlertCircle size={14} className="text-orange-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-800 font-medium truncate">{t.drawing_name}</span>
                {t.deadline && (
                  <span className="text-xs text-orange-600 ml-1.5 font-medium">
                    Hạn: {new Date(t.deadline).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Tìm theo tên công việc..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              <select
                value={filterEngineer}
                onChange={e => setFilterEngineer(e.target.value)}
                className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all appearance-none"
              >
                <option value="">Tất cả người phụ trách</option>
                {uniqueEngineers.map(eng => (
                  <option key={eng} value={eng}>{eng}</option>
                ))}
              </select>
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all appearance-none"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="Đang làm">Đang làm</option>
              <option value="Chờ duyệt">Chờ duyệt</option>
              <option value="Hoàn thành">Hoàn thành</option>
              <option value="Đã hủy">Đã hủy</option>
              <option value="Tạm hoãn">Tạm hoãn</option>
            </select>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-sm font-medium transition-colors"
              >
                <X size={14} />
                Xóa lọc
              </button>
            )}
            <button
              onClick={() => exportToCSV(filteredTasks)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-sm font-medium transition-colors"
              title="Xuất CSV"
            >
              <FileDown size={16} />
              <span className="hidden sm:inline">Xuất CSV</span>
            </button>
            <button
              onClick={() => exportToExcel(filteredTasks).catch(err => console.error('Excel export failed:', err))}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white hover:bg-green-700 rounded-xl text-sm font-medium transition-colors"
              title="Xuất Excel"
            >
              <FileSpreadsheet size={16} />
              <span className="hidden sm:inline">Xuất Excel</span>
            </button>
            {canAddTask && (
              <button
                onClick={onAddTask}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm shadow-emerald-500/20"
                title="Thêm Task"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Thêm Task</span>
              </button>
            )}
          </div>
        </div>
        {hasActiveFilters && (
          <p className="mt-2 text-xs text-slate-500">
            Hiển thị {filteredTasks.length} / {rootTasks.length} công việc
          </p>
        )}
      </div>

    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', minWidth: COLUMNS.reduce((s, c) => s + colWidths[c.key], 0) }}>
          <colgroup>
            {COLUMNS.map(col => (
              <col key={col.key} style={{ width: colWidths[col.key] }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-slate-50 border-bottom border-slate-200 sticky top-0 z-10">
              {COLUMNS.map((col, idx) => (
                <th
                  key={col.key}
                  className={`px-4 md:px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap relative select-none ${col.key === 'actions' ? 'text-right' : ''} ${idx === 0 ? 'sticky left-0 z-20 bg-slate-50' : ''}`}
                >
                  {col.label}
                  {idx < COLUMNS.length - 1 && (
                    <div
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-emerald-400/60 active:bg-emerald-500/80"
                      onMouseDown={(e) => handleResizeMouseDown(e, col.key)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-6 py-10 text-center text-slate-400 text-sm">
                  {hasActiveFilters ? 'Không tìm thấy công việc phù hợp với bộ lọc.' : 'Chưa có công việc nào.'}
                </td>
              </tr>
            )}
            {filteredTasks.map((task, taskIndex) => {
              const children = childTasksMap.get(task.id) ?? [];
              const hasChildren = children.length > 0;
              const isExpanded = expandedIds.has(task.id);
              const rowBgClass = taskIndex % 2 === 0 ? '' : 'bg-slate-50/80';
              const rollupHours = hasChildren ? children.reduce((s, c) => s + (c.actual_hours ?? 0), 0) : null;
              const rollupTargetHours = hasChildren ? children.reduce((s, c) => s + (c.target_hours ?? 0), 0) : null;
              const rollupCost = hasChildren ? children.reduce((s, c) => s + (c.cost ?? 0), 0) : null;
              const displayHours = rollupHours !== null ? rollupHours : task.actual_hours;
              const displayTargetHours = rollupTargetHours !== null ? rollupTargetHours : task.target_hours;
              const displayCost = rollupCost !== null ? rollupCost : task.cost;

              const renderTaskRow = (t: Task, isChild: boolean, bgClass: string = '') => {
                const childList = childTasksMap.get(t.id) ?? [];
                const childHasChildren = childList.length > 0;
                const childIsExpanded = expandedIds.has(t.id);
                const childRollupHours = childHasChildren ? childList.reduce((s, c) => s + (c.actual_hours ?? 0), 0) : null;
                const childRollupTargetHours = childHasChildren ? childList.reduce((s, c) => s + (c.target_hours ?? 0), 0) : null;
                const childRollupCost = childHasChildren ? childList.reduce((s, c) => s + (c.cost ?? 0), 0) : null;
                const rowHours = childRollupHours !== null ? childRollupHours : t.actual_hours;
                const rowTargetHours = childRollupTargetHours !== null ? childRollupTargetHours : t.target_hours;
                const rowCost = childRollupCost !== null ? childRollupCost : t.cost;

                return (
                  <tr key={t.id} className={`hover:bg-blue-50 transition-colors group ${bgClass}`}>
                    <td className={`py-4 overflow-hidden whitespace-nowrap sticky left-0 z-[2] ${bgClass || 'bg-white'} group-hover:bg-blue-50 transition-colors ${isChild ? 'pl-10 pr-4 md:pl-14 md:pr-6' : 'px-4 md:px-6'}`}>
                      <div className="flex items-center gap-1.5">
                        {childHasChildren ? (
                          <button
                            onClick={() => setExpandedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
                              return next;
                            })}
                            className="flex-shrink-0 p-0.5 text-slate-400 hover:text-emerald-600 transition-colors"
                            title={childIsExpanded ? 'Thu gọn' : 'Mở rộng'}
                          >
                            {childIsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        ) : (
                          <span className="flex-shrink-0 w-5" />
                        )}
                        <span
                          className={`font-medium cursor-pointer ${isChild ? 'text-slate-700' : 'text-slate-900'}`}
                          onClick={(e) => showCellTooltip(e, t.drawing_name)}
                        >
                          {t.drawing_name}
                          {childHasChildren && (
                            <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                              {childList.length} con
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className={`py-4 overflow-hidden cursor-pointer ${isChild ? 'pl-2 pr-4 md:pr-6' : 'px-4 md:px-6'}`} onClick={(e) => showCellTooltip(e, t.description)}>
                      <div className="flex flex-col gap-0.5">
                        {t.description ? (
                          <span className="text-sm text-slate-700 line-clamp-2 whitespace-normal">{t.description}</span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Chưa có</span>
                        )}
                        <span className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm text-slate-600 overflow-hidden whitespace-nowrap cursor-pointer" onClick={(e) => showCellTooltip(e, t.engineer_name)}>{t.engineer_name}</td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            className={i < t.difficulty ? "text-amber-400 fill-amber-400" : "text-slate-200"}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      {t.deadline ? (
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${
                            new Date(t.deadline) < new Date() && !isInactiveStatus(t.status)
                              ? 'text-rose-600'
                              : 'text-slate-700'
                          }`}>
                            {new Date(t.deadline).toLocaleDateString('vi-VN')}
                          </span>
                          {new Date(t.deadline) < new Date() && !isInactiveStatus(t.status) && (
                            <span className="text-[10px] text-rose-500 font-bold uppercase">Quá hạn</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Chưa đặt</span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className={`text-sm ${getProductivityColor(rowTargetHours, rowHours)}`}>
                          {rowHours > 0 ? `${((rowTargetHours / rowHours) * 100).toFixed(1)}%` : '-%'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {rowTargetHours}h / {rowHours.toFixed(1)}h
                          {childHasChildren && <span className="text-emerald-500 ml-1">Σ</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      {rowCost != null && rowCost > 0 ? (
                        <span className="text-sm font-medium text-slate-700">
                          {rowCost.toLocaleString('vi-VN')} ₫
                          {childHasChildren && <span className="text-emerald-500 ml-1 text-[10px]">Σ</span>}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Chưa có</span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      <ActualHoursInput task={t} onRefresh={onRefresh} readOnly={!canEdit || childHasChildren} />
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      {t.drive_link ? (
                        <a
                          href={t.drive_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors"
                          title="Tải file từ Drive"
                        >
                          <Download size={14} />
                          Tải về
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Chưa có</span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      {t.viewer_link ? (
                        <button
                          onClick={() => onViewDrawing(t.viewer_link!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-medium transition-colors"
                          title="Xem bản vẽ (ảnh/PDF)"
                        >
                          <Eye size={14} />
                          Xem
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Chưa có</span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      <button
                        onClick={() => setCommentTaskId(t.id)}
                        className="relative flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 border border-slate-200 hover:border-emerald-300 rounded-lg text-xs font-medium transition-colors"
                        title="Xem bình luận"
                      >
                        <MessageSquare size={14} />
                        {(commentCounts[t.id] ?? 0) > 0 && (
                          <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                            {commentCounts[t.id]}
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-right overflow-hidden whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 relative">
                        {(t.viewer_link || t.drive_link) && (
                          <button
                            onClick={() => onViewDrawing((t.viewer_link || t.drive_link)!)}
                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Xem nhanh file PDF/ảnh"
                          >
                            <Eye size={18} />
                          </button>
                        )}
                        {t.drive_link && (
                          <a
                            href={t.drive_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Mở Drive"
                          >
                            <ExternalLink size={18} />
                          </a>
                        )}
                        {(canEdit || canDelete) && (
                          <button
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                              setOpenMenuId(openMenuId === t.id ? null : t.id);
                            }}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>
                        )}
                        {openMenuId === t.id && (
                          <TaskContextMenu
                            task={t}
                            onClose={() => setOpenMenuId(null)}
                            onRefresh={onRefresh}
                            onEdit={(editedTask) => { setEditTask(editedTask); setOpenMenuId(null); }}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            position={menuPos}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              };

              return (
                <React.Fragment key={task.id}>
                  {/* Parent row */}
                  <tr className={`hover:bg-blue-50 transition-colors group ${hasChildren ? 'border-l-2 border-l-emerald-400' : ''} ${rowBgClass}`}>
                    <td className={`px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap sticky left-0 z-[2] ${rowBgClass || 'bg-white'} group-hover:bg-blue-50 transition-colors`}>
                      <div className="flex items-center gap-1.5">
                        {hasChildren ? (
                          <button
                            onClick={() => setExpandedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
                              return next;
                            })}
                            className="flex-shrink-0 p-0.5 text-slate-400 hover:text-emerald-600 transition-colors"
                            title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        ) : (
                          <span className="flex-shrink-0 w-5" />
                        )}
                        <span
                          className="font-medium text-slate-900 cursor-pointer"
                          onClick={(e) => showCellTooltip(e, task.drawing_name)}
                        >
                          {task.drawing_name}
                          {hasChildren && (
                            <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                              {children.length} con
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden cursor-pointer" onClick={(e) => showCellTooltip(e, task.description)}>
                      <div className="flex flex-col gap-0.5">
                        {task.description ? (
                          <span className="text-sm text-slate-700 line-clamp-2 whitespace-normal">{task.description}</span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Chưa có</span>
                        )}
                        <span className="text-xs text-slate-400">{new Date(task.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm text-slate-600 overflow-hidden whitespace-nowrap cursor-pointer" onClick={(e) => showCellTooltip(e, task.engineer_name)}>{task.engineer_name}</td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            className={i < task.difficulty ? "text-amber-400 fill-amber-400" : "text-slate-200"}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      {task.deadline ? (
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${
                            new Date(task.deadline) < new Date() && !isInactiveStatus(task.status)
                              ? 'text-rose-600'
                              : 'text-slate-700'
                          }`}>
                            {new Date(task.deadline).toLocaleDateString('vi-VN')}
                          </span>
                          {new Date(task.deadline) < new Date() && !isInactiveStatus(task.status) && (
                            <span className="text-[10px] text-rose-500 font-bold uppercase">Quá hạn</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Chưa đặt</span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className={`text-sm ${getProductivityColor(displayTargetHours, displayHours)}`}>
                          {displayHours > 0 ? `${((displayTargetHours / displayHours) * 100).toFixed(1)}%` : '-%'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {displayTargetHours}h / {displayHours.toFixed(1)}h
                          {hasChildren && <span className="text-emerald-500 ml-1">Σ</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      {displayCost != null && displayCost > 0 ? (
                        <span className="text-sm font-medium text-slate-700">
                          {displayCost.toLocaleString('vi-VN')} ₫
                          {hasChildren && <span className="text-emerald-500 ml-1 text-[10px]">Σ</span>}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Chưa có</span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      <ActualHoursInput task={task} onRefresh={onRefresh} readOnly={!canEdit || hasChildren} />
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      {task.drive_link ? (
                        <a
                          href={task.drive_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors"
                          title="Tải file từ Drive"
                        >
                          <Download size={14} />
                          Tải về
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Chưa có</span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      {task.viewer_link ? (
                        <button
                          onClick={() => onViewDrawing(task.viewer_link!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-medium transition-colors"
                          title="Xem bản vẽ (ảnh/PDF)"
                        >
                          <Eye size={14} />
                          Xem
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Chưa có</span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-4 overflow-hidden whitespace-nowrap">
                      <button
                        onClick={() => setCommentTaskId(task.id)}
                        className="relative flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 border border-slate-200 hover:border-emerald-300 rounded-lg text-xs font-medium transition-colors"
                        title="Xem bình luận"
                      >
                        <MessageSquare size={14} />
                        {(commentCounts[task.id] ?? 0) > 0 && (
                          <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                            {commentCounts[task.id]}
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-right overflow-hidden whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 relative">
                        {(task.viewer_link || task.drive_link) && (
                          <button
                            onClick={() => onViewDrawing((task.viewer_link || task.drive_link)!)}
                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Xem nhanh file PDF/ảnh"
                          >
                            <Eye size={18} />
                          </button>
                        )}
                        {task.drive_link && (
                          <a
                            href={task.drive_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Mở Drive"
                          >
                            <ExternalLink size={18} />
                          </a>
                        )}
                        {(canEdit || canDelete) && (
                          <button
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                              setOpenMenuId(openMenuId === task.id ? null : task.id);
                            }}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>
                        )}
                        {openMenuId === task.id && (
                          <TaskContextMenu
                            task={task}
                            onClose={() => setOpenMenuId(null)}
                            onRefresh={onRefresh}
                            onEdit={(t) => { setEditTask(t); setOpenMenuId(null); }}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            position={menuPos}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Child rows (shown when expanded) */}
                  {isExpanded && children.map(child => renderTaskRow(child, true, rowBgClass))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {editTask && (
        <EditTaskForm
          task={editTask}
          onClose={() => setEditTask(null)}
          onSuccess={() => { setEditTask(null); onRefresh(); }}
        />
      )}
      {commentTaskId && (
        <TaskCommentSection
          taskId={commentTaskId}
          taskName={tasks.find((t) => t.id === commentTaskId)?.drawing_name ?? ''}
          onClose={() => setCommentTaskId(null)}
        />
      )}
    </div>

    {cellTooltip && (
      <div
        ref={cellTooltipRef}
        className="fixed z-[200] bg-slate-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl max-w-xs break-words leading-relaxed pointer-events-auto"
        style={{ top: cellTooltip.y, left: cellTooltip.x }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {cellTooltip.text}
      </div>
    )}
    </div>
  );
};
