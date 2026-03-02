import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Phone, Mail, User, ZoomIn, ZoomOut, RotateCcw, CheckCircle2, Clock, Briefcase, Plus, Pencil, Trash2, Save, Settings2, ChevronUp, ChevronDown } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Engineer, Task } from '../types/database.types';
import { useDepartments, COLOR_CONFIGS, COLOR_OPTIONS, LEGACY_DEPT_MAP, type Department } from '../lib/useDepartments';

const STATUS_COLORS: Record<string, string> = {
  'Hoàn thành': 'bg-emerald-100 text-emerald-700',
  'Đang làm': 'bg-blue-100 text-blue-700',
  'Chờ duyệt': 'bg-amber-100 text-amber-700',
  'Tạm hoãn': 'bg-slate-100 text-slate-600',
  'Đã hủy': 'bg-rose-100 text-rose-700',
};

// ─── Department Management Modal ──────────────────────────────────────────────

interface DeptManagerProps {
  departments: Department[];
  onAdd: (name: string, colorKey: string, parentId?: string) => Promise<void>;
  onUpdate: (id: string, name: string, colorKey: string, parentId?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (id: string, direction: 'up' | 'down') => Promise<void>;
  onClose: () => void;
}

const COLOR_LABELS: Record<string, string> = {
  rose: 'Đỏ hồng',
  blue: 'Xanh dương',
  amber: 'Vàng hổ phách',
  emerald: 'Xanh lá',
  purple: 'Tím',
  slate: 'Xám',
  cyan: 'Xanh lam',
  orange: 'Cam',
};

const DeptManager: React.FC<DeptManagerProps> = ({ departments, onAdd, onUpdate, onDelete, onReorder, onClose }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('blue');
  const [editParentId, setEditParentId] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [newParentId, setNewParentId] = useState('');
  const [saving, setSaving] = useState(false);

  // Returns the set of IDs of the given department and all its descendants (to prevent circular refs)
  const getDescendantIds = (id: string): Set<string> => {
    const result = new Set<string>([id]);
    const queue = [id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      departments.filter((d) => d.parentId === current).forEach((child) => {
        result.add(child.id);
        queue.push(child.id);
      });
    }
    return result;
  };

  const startEdit = (dept: Department) => {
    setEditingId(dept.id);
    setEditName(dept.name);
    setEditColor(dept.colorKey);
    setEditParentId(dept.parentId ?? '');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    await onUpdate(editingId, editName.trim(), editColor, editParentId || undefined);
    setEditingId(null);
    setSaving(false);
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    await onAdd(newName.trim(), newColor, newParentId || undefined);
    setNewName('');
    setNewColor('blue');
    setNewParentId('');
    setSaving(false);
  };

  const handleDelete = async (dept: Department) => {
    if (!window.confirm(`Bạn có chắc muốn xóa phòng ban "${dept.name}"?`)) return;
    await onDelete(dept.id);
  };

  // Build a display list: top-level depts sorted by order, then their children indented
  const topLevel = departments.filter((d) => !d.parentId).sort((a, b) => a.order - b.order);
  const getChildren = (parentId: string) =>
    departments.filter((d) => d.parentId === parentId).sort((a, b) => a.order - b.order);

  const renderDept = (dept: Department, isChild: boolean) => {
    const cfg = COLOR_CONFIGS[dept.colorKey] ?? COLOR_CONFIGS['slate'];
    const siblings = departments
      .filter((d) => (d.parentId ?? '') === (dept.parentId ?? ''))
      .sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((d) => d.id === dept.id);

    return (
      <React.Fragment key={dept.id}>
        <div className={`flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 ${isChild ? 'ml-6' : ''}`}>
          {editingId === dept.id ? (
            <>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              />
              <select
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none"
              >
                {COLOR_OPTIONS.map((c) => (
                  <option key={c} value={c}>{COLOR_LABELS[c] ?? c}</option>
                ))}
              </select>
              <select
                value={editParentId}
                onChange={(e) => setEditParentId(e.target.value)}
                className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none"
              >
                <option value="">-- Cấp gốc --</option>
                {departments
                  .filter((d) => !getDescendantIds(dept.id).has(d.id))
                  .map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
              <button
                onClick={() => void handleSaveEdit()}
                disabled={saving}
                className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
              >
                <Save size={15} />
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X size={15} />
              </button>
            </>
          ) : (
            <>
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${cfg.dot}`} />
              <span className="flex-1 text-sm font-medium text-slate-800">{dept.name}</span>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => void onReorder(dept.id, 'up')}
                  disabled={idx === 0}
                  className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 rounded transition-colors"
                  title="Lên"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  onClick={() => void onReorder(dept.id, 'down')}
                  disabled={idx === siblings.length - 1}
                  className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 rounded transition-colors"
                  title="Xuống"
                >
                  <ChevronDown size={13} />
                </button>
              </div>
              <button
                onClick={() => startEdit(dept)}
                className="p-1.5 text-slate-400 hover:text-emerald-500 rounded-lg transition-colors"
                title="Chỉnh sửa"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => void handleDelete(dept)}
                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                title="Xóa"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
        {getChildren(dept.id).map((child) => renderDept(child, true))}
      </React.Fragment>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-lg">
              <Settings2 className="text-white" size={20} />
            </div>
            <h2 className="font-bold text-slate-900 text-lg">Quản lý phòng ban</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
            <X size={22} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-2">
          {topLevel.map((dept) => renderDept(dept, false))}

          {/* Add new department */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase">Thêm phòng ban mới</p>
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tên phòng ban mới..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
              />
              <select
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
              >
                {COLOR_OPTIONS.map((c) => (
                  <option key={c} value={c}>{COLOR_LABELS[c] ?? c}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
              >
                <option value="">-- Phòng ban cấp gốc --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <button
                onClick={() => void handleAdd()}
                disabled={saving || !newName.trim()}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 disabled:bg-slate-300 transition-colors"
              >
                <Plus size={15} />
                Thêm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Engineer Popup ────────────────────────────────────────────────────────────

interface EngineerPopupProps {
  engineer: Engineer;
  tasks: Task[];
  onClose: () => void;
}

const EngineerPopup: React.FC<EngineerPopupProps> = ({ engineer, tasks, onClose }) => {
  const engTasks = tasks.filter(
    (t) => t.engineer_name === engineer.full_name && t.status !== 'Hoàn thành' && t.status !== 'Đã hủy',
  );
  const completedCount = tasks.filter(
    (t) => t.engineer_name === engineer.full_name && t.status === 'Hoàn thành',
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            {engineer.photo_url ? (
              <img
                src={engineer.photo_url}
                alt={engineer.full_name}
                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <User size={22} className="text-slate-500" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">{engineer.full_name}</h3>
              <span className="text-xs text-slate-500">{engineer.position}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông tin liên hệ</h4>
            {engineer.email ? (
              <a href={`mailto:${engineer.email}`} className="flex items-center gap-2.5 text-sm text-emerald-600 hover:underline">
                <Mail size={15} className="flex-shrink-0 text-slate-400" />
                {engineer.email}
              </a>
            ) : (
              <p className="flex items-center gap-2.5 text-sm text-slate-400 italic">
                <Mail size={15} className="flex-shrink-0" />
                Chưa có email
              </p>
            )}
            {engineer.phone ? (
              <a href={`tel:${engineer.phone}`} className="flex items-center gap-2.5 text-sm text-emerald-600 hover:underline">
                <Phone size={15} className="flex-shrink-0 text-slate-400" />
                {engineer.phone}
              </a>
            ) : (
              <p className="flex items-center gap-2.5 text-sm text-slate-400 italic">
                <Phone size={15} className="flex-shrink-0" />
                Chưa có số điện thoại
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{engTasks.length}</p>
              <p className="text-xs text-blue-600 mt-0.5">Task đang làm</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{completedCount}</p>
              <p className="text-xs text-emerald-600 mt-0.5">Task hoàn thành</p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase size={13} />
              Task đang đảm nhận ({engTasks.length})
            </h4>
            {engTasks.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl">
                Không có task đang hoạt động
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {engTasks.map((t) => (
                  <div key={t.id} className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    {t.status === 'Hoàn thành' ? (
                      <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Clock size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{t.drawing_name}</p>
                      {t.deadline && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Hạn: {new Date(t.deadline).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[t.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Org Chart Page ────────────────────────────────────────────────────────────

interface OrgChartPageProps {
  tasks: Task[];
}

export const OrgChartPage: React.FC<OrgChartPageProps> = ({ tasks }) => {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEng, setSelectedEng] = useState<Engineer | null>(null);
  const [showDeptManager, setShowDeptManager] = useState(false);
  const [scale, setScale] = useState(0.9);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const { departments, loading: deptLoading, addDepartment, updateDepartment, deleteDepartment, reorderDepartment } = useDepartments();

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'engineers'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setEngineers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Engineer));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setScale((s) => Math.min(Math.max(s * factor, 0.25), 3));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    e.currentTarget instanceof HTMLElement && (e.currentTarget.style.cursor = 'grabbing');
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setTranslate((t) => ({ x: t.x + dx, y: t.y + dy }));
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    isPanning.current = false;
    e.currentTarget instanceof HTMLElement && (e.currentTarget.style.cursor = 'grab');
  }, []);

  const handleReset = () => {
    setScale(0.9);
    setTranslate({ x: 0, y: 0 });
  };

  // Group engineers by their department field, falling back to legacy position map
  const getDeptName = (eng: Engineer) =>
    eng.department ?? LEGACY_DEPT_MAP[eng.position] ?? 'Hành chính';

  const grouped = departments.reduce<Record<string, Engineer[]>>((acc, d) => {
    acc[d.name] = engineers.filter((e) => getDeptName(e) === d.name);
    return acc;
  }, {});

  const topLevelDepts = departments.filter((d) => !d.parentId).sort((a, b) => a.order - b.order);
  const getChildDepts = (parentId: string) =>
    departments.filter((d) => d.parentId === parentId).sort((a, b) => a.order - b.order);

  const renderMembers = (members: Engineer[], cfg: (typeof COLOR_CONFIGS)[string]) => (
    <>
      <div className="w-0.5 bg-slate-300 h-6" />
      <div className="relative flex items-start justify-center gap-3">
        {members.length > 1 && (
          <div className="absolute top-0 bg-slate-300" style={{ height: '2px', left: 40, right: 40 }} />
        )}
        {members.map((eng) => (
          <div key={eng.id} className="flex flex-col items-center">
            <div className="w-0.5 bg-slate-300 h-5" />
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedEng(eng); }}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 bg-white cursor-pointer text-left w-[130px] ${cfg.nodeBorder}`}
            >
              {eng.photo_url ? (
                <img src={eng.photo_url} alt={eng.full_name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0" />
              ) : (
                <div className={`w-10 h-10 rounded-full ${cfg.nodeLight} flex items-center justify-center flex-shrink-0`}>
                  <User size={18} className={cfg.nodeText} />
                </div>
              )}
              <div className="text-center w-full">
                <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">{eng.full_name}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block ${cfg.badge}`}>
                  {eng.position}
                </span>
              </div>
              {(() => {
                const activeCount = tasks.filter(
                  (t) => t.engineer_name === eng.full_name && t.status !== 'Hoàn thành' && t.status !== 'Đã hủy',
                ).length;
                return activeCount > 0 ? (
                  <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">{activeCount} task</span>
                ) : null;
              })()}
            </button>
          </div>
        ))}
      </div>
    </>
  );

  const renderDeptColumn = (dept: Department) => {
    const cfg = COLOR_CONFIGS[dept.colorKey] ?? COLOR_CONFIGS['slate'];
    const members = grouped[dept.name] ?? [];
    const children = getChildDepts(dept.id);
    return (
      <div key={dept.id} className="flex flex-col items-center" style={{ minWidth: 160 }}>
        <div className="w-0.5 bg-slate-400 h-8" />
        <div className={`${cfg.headerBg} text-white px-5 py-3 rounded-xl shadow-lg text-center w-full`}>
          <p className="font-bold text-sm">{dept.name}</p>
          <p className="text-xs opacity-75 mt-0.5">{members.length} thành viên</p>
        </div>
        {members.length > 0 ? renderMembers(members, cfg) : (
          <>
            <div className="w-0.5 bg-slate-300 h-6" />
            <div className="border-2 border-dashed border-slate-300 rounded-xl px-4 py-3 text-center w-[130px]">
              <p className="text-xs text-slate-400 italic">Chưa có thành viên</p>
            </div>
          </>
        )}
        {children.length > 0 && (
          <div className="mt-4 flex flex-col items-center w-full">
            <div className="w-0.5 bg-slate-300 h-4" />
            <div className="relative flex items-start justify-center gap-6">
              {children.length > 1 && (
                <div className="absolute top-0 bg-slate-300" style={{ height: '2px', left: 40, right: 40 }} />
              )}
              {children.map((child) => renderDeptColumn(child))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading || deptLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Đang tải sơ đồ phòng ban...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Sơ đồ phòng ban</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Kéo để di chuyển · Cuộn để phóng to/thu nhỏ · Nhấn vào nhân sự để xem chi tiết
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowDeptManager(true)}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm"
          >
            <Settings2 size={16} />
            Quản lý phòng ban
          </button>
          <button
            onClick={() => setScale((s) => Math.min(s * 1.2, 3))}
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
            title="Phóng to"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(s * 0.8, 0.25))}
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
            title="Thu nhỏ"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={handleReset}
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
            title="Đặt lại"
          >
            <RotateCcw size={18} />
          </button>
          <span className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded-lg min-w-[52px] text-center">
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div
        ref={containerRef}
        className="relative bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden select-none"
        style={{ height: '70vh', cursor: 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Dot grid background */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="org-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#cbd5e1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#org-dots)" />
        </svg>

        {/* Zoomable / pannable content */}
        <div
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'top center',
            position: 'absolute',
            top: 40,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Root company node */}
          <div className="flex flex-col items-center">
            <div className="bg-slate-800 text-white px-8 py-4 rounded-2xl shadow-xl border-2 border-slate-700 text-center min-w-[180px]">
              <div className="flex items-center justify-center gap-2 mb-1">
                <svg width="20" height="20" viewBox="0 0 40 40">
                  <rect width="40" height="40" rx="6" fill="white" />
                  <text x="2" y="30" fontFamily="Arial Black,sans-serif" fontSize="28" fontWeight="900" fill="#dc2626">D</text>
                  <text x="16" y="30" fontFamily="Arial Black,sans-serif" fontSize="28" fontWeight="900" fill="#111827">G</text>
                </svg>
                <span className="font-bold text-base">DG Company</span>
              </div>
              <p className="text-slate-400 text-xs">Tổng công ty</p>
            </div>

            {/* Vertical line down from root */}
            <div className="w-0.5 bg-slate-400 h-8" />

            {/* Top-level Departments */}
            <div className="relative flex items-start justify-center gap-8">
              {/* Horizontal connector line */}
              <div
                className="absolute top-0 bg-slate-400"
                style={{ height: '2px', left: '40px', right: '40px' }}
              />
              {topLevelDepts.map((dept) => renderDeptColumn(dept))}
            </div>
          </div>
        </div>
      </div>

      {/* Department Manager Modal */}
      {showDeptManager && (
        <DeptManager
          departments={departments}
          onAdd={addDepartment}
          onUpdate={updateDepartment}
          onDelete={deleteDepartment}
          onReorder={reorderDepartment}
          onClose={() => setShowDeptManager(false)}
        />
      )}

      {/* Engineer popup */}
      {selectedEng && (
        <EngineerPopup
          engineer={selectedEng}
          tasks={tasks}
          onClose={() => setSelectedEng(null)}
        />
      )}
    </div>
  );
};
