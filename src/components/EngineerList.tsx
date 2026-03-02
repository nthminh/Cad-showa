import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Save, Pencil, Trash2, User, Camera, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Engineer } from '../types/database.types';
import { useDepartments } from '../lib/useDepartments';

const POSITIONS = ['Kỹ sư', 'Kỹ sư trưởng', 'Quản lý dự án', 'Giám đốc', 'Nhân viên', 'Thực tập sinh', 'Công nhân'];

type EngineerSortKey = 'full_name' | 'date_of_birth' | 'position' | 'department' | 'basic_salary' | 'email' | 'phone';
type SortDir = 'asc' | 'desc';

const ENG_COLUMNS: { key: string; label: string; defaultWidth: number; sortKey?: EngineerSortKey }[] = [
  { key: 'photo', label: 'Ảnh', defaultWidth: 72 },
  { key: 'full_name', label: 'Họ và tên', defaultWidth: 160, sortKey: 'full_name' },
  { key: 'date_of_birth', label: 'Ngày sinh', defaultWidth: 120, sortKey: 'date_of_birth' },
  { key: 'position', label: 'Chức danh', defaultWidth: 130, sortKey: 'position' },
  { key: 'department', label: 'Phòng ban', defaultWidth: 130, sortKey: 'department' },
  { key: 'basic_salary', label: 'Lương căn bản', defaultWidth: 150, sortKey: 'basic_salary' },
  { key: 'email', label: 'Email', defaultWidth: 180, sortKey: 'email' },
  { key: 'phone', label: 'Điện thoại', defaultWidth: 130, sortKey: 'phone' },
  { key: 'actions', label: 'Thao tác', defaultWidth: 100 },
];
type EngColKey = typeof ENG_COLUMNS[number]['key'];
const DEFAULT_ENG_COL_WIDTHS: Record<EngColKey, number> = Object.fromEntries(
  ENG_COLUMNS.map(c => [c.key, c.defaultWidth])
) as Record<EngColKey, number>;

interface EngineerFormProps {
  initial?: Partial<Engineer>;
  onClose: () => void;
  onSaved: () => void;
}

const EngineerForm: React.FC<EngineerFormProps> = ({ initial, onClose, onSaved }) => {
  const { departments } = useDepartments();
  const [form, setForm] = useState({
    full_name: initial?.full_name ?? '',
    date_of_birth: initial?.date_of_birth ?? '',
    position: initial?.position ?? 'Kỹ sư',
    department: initial?.department ?? '',
    photo_url: initial?.photo_url ?? '',
    basic_salary: initial?.basic_salary ?? 0,
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(initial?.photo_url ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      setError('Ảnh không được lớn hơn 500KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotoPreview(dataUrl);
      setForm(f => ({ ...f, photo_url: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setLoading(true);
    setError(null);
    try {
      if (initial?.id) {
        await updateDoc(doc(db, 'engineers', initial.id), { ...form });
      } else {
        await addDoc(collection(db, 'engineers'), { ...form, created_at: new Date().toISOString() });
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-lg">
              <User className="text-white" size={20} />
            </div>
            <h2 className="font-bold text-slate-900 text-lg">
              {initial?.id ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>
          )}

          {/* Photo Upload */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-emerald-400 transition-colors relative group"
              onClick={() => fileRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <Camera className="text-slate-400 group-hover:text-emerald-400 transition-colors" size={32} />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs text-emerald-600 hover:underline font-medium"
            >
              {photoPreview ? 'Đổi ảnh' : 'Tải ảnh lên (≤500KB)'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Họ và tên</label>
            <input
              required
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Nguyễn Văn A"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Ngày tháng năm sinh</label>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Chức danh</label>
            <select
              value={form.position}
              onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            >
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Phòng ban</label>
            <select
              value={form.department}
              onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            >
              <option value="">-- Chọn phòng ban --</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="engineer@example.com"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Số điện thoại</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="0901234567"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Lương căn bản (VNĐ/tháng)</label>
            <input
              type="number"
              min="0"
              step="100000"
              value={form.basic_salary}
              onChange={e => setForm(f => ({ ...f, basic_salary: parseInt(e.target.value, 10) || 0 }))}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
            >
              <Save size={18} />
              {loading ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const EngineerList: React.FC<{ canManage?: boolean }> = ({ canManage = true }) => {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEngineer, setEditEngineer] = useState<Engineer | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<EngineerSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [colWidths, setColWidths] = useState<Record<EngColKey, number>>({ ...DEFAULT_ENG_COL_WIDTHS });
  const resizeRef = useRef<{ col: EngColKey; startX: number; startW: number } | null>(null);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const q = query(collection(db, 'engineers'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setEngineers(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Engineer));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (engineer: Engineer) => {
    if (!db) return;
    if (!window.confirm(`Bạn có chắc muốn xóa nhân viên "${engineer.full_name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'engineers', engineer.id));
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi xóa.');
    }
  };

  const handleSort = (key: EngineerSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent, col: EngColKey) => {
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

  const q = search.trim().toLowerCase();
  const filtered = q
    ? engineers.filter(eng =>
        eng.full_name.toLowerCase().includes(q) ||
        eng.position.toLowerCase().includes(q) ||
        (eng.department ?? '').toLowerCase().includes(q) ||
        (eng.email ?? '').toLowerCase().includes(q) ||
        (eng.phone ?? '').includes(q),
      )
    : engineers;

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        let av: string | number = '';
        let bv: string | number = '';
        if (sortKey === 'basic_salary') {
          av = a.basic_salary ?? 0;
          bv = b.basic_salary ?? 0;
        } else {
          av = (a[sortKey] ?? '') as string;
          bv = (b[sortKey] ?? '') as string;
          av = av.toLowerCase();
          bv = bv.toLowerCase();
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : filtered;

  const SortIcon = ({ col }: { col: EngineerSortKey }) => (
    <span className="inline-flex flex-col ml-1 leading-none">
      <ChevronUp size={10} className={sortKey === col && sortDir === 'asc' ? 'text-emerald-500' : 'text-slate-300'} />
      <ChevronDown size={10} className={sortKey === col && sortDir === 'desc' ? 'text-emerald-500' : 'text-slate-300'} />
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Danh sách nhân viên</h3>
          <p className="text-sm text-slate-500 mt-0.5">Quản lý thông tin nhân viên trong công ty</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm nhân viên..."
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none w-56"
            />
          </div>
          {canManage && (
            <button
              onClick={() => { setEditEngineer(null); setShowForm(true); }}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Plus size={18} />
              Thêm nhân viên
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', minWidth: ENG_COLUMNS.reduce((s, c) => s + colWidths[c.key], 0) }}>
            <colgroup>
              {ENG_COLUMNS.map(col => (
                <col key={col.key} style={{ width: colWidths[col.key] }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                {ENG_COLUMNS.map((col, idx) => (
                  <th
                    key={col.key}
                    className={`px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap relative select-none ${col.key === 'actions' ? 'text-right' : ''} ${col.sortKey ? 'cursor-pointer hover:bg-slate-100' : ''}`}
                    onClick={col.sortKey ? () => handleSort(col.sortKey!) : undefined}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {col.label}
                      {col.sortKey && <SortIcon col={col.sortKey} />}
                    </span>
                    {idx < ENG_COLUMNS.length - 1 && (
                      <div
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-emerald-400/60 active:bg-emerald-500/80"
                        onClick={e => e.stopPropagation()}
                        onMouseDown={(e) => handleResizeMouseDown(e, col.key as EngColKey)}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={ENG_COLUMNS.length} className="px-6 py-10 text-center text-slate-400 text-sm">Đang tải...</td></tr>
              )}
              {!loading && engineers.length === 0 && (
                <tr><td colSpan={ENG_COLUMNS.length} className="px-6 py-10 text-center text-slate-400 text-sm">Chưa có nhân viên nào. Nhấn "Thêm nhân viên" để bắt đầu.</td></tr>
              )}
              {!loading && engineers.length > 0 && sorted.length === 0 && (
                <tr><td colSpan={ENG_COLUMNS.length} className="px-6 py-10 text-center text-slate-400 text-sm">Không tìm thấy nhân viên phù hợp.</td></tr>
              )}
              {!loading && sorted.map(eng => (
                <tr key={eng.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4">
                    {eng.photo_url ? (
                      <img src={eng.photo_url} alt={eng.full_name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                        <User size={18} className="text-slate-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-900 truncate">{eng.full_name}</td>
                  <td className="px-4 py-4 text-sm text-slate-600 truncate">
                    {eng.date_of_birth ? (() => {
                      const d = new Date(eng.date_of_birth);
                      return isNaN(d.getTime()) ? <span className="text-slate-400 italic">Không hợp lệ</span> : d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
                    })() : <span className="text-slate-400 italic">Chưa có</span>}
                  </td>
                  <td className="px-4 py-4 truncate">
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">
                      {eng.position}
                    </span>
                  </td>
                  <td className="px-4 py-4 truncate">
                    {eng.department ? (
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                        {eng.department}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-sm">Chưa có</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700 truncate">
                    {eng.basic_salary > 0 ? eng.basic_salary.toLocaleString('vi-VN') + ' ₫' : <span className="text-slate-400 italic">Chưa có</span>}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600 truncate">
                    {eng.email ? (
                      <a href={`mailto:${eng.email}`} className="text-emerald-600 hover:underline">{eng.email}</a>
                    ) : <span className="text-slate-400 italic">Chưa có</span>}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600 truncate">
                    {eng.phone ? (
                      <a href={`tel:${eng.phone}`} className="text-emerald-600 hover:underline">{eng.phone}</a>
                    ) : <span className="text-slate-400 italic">Chưa có</span>}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditEngineer(eng); setShowForm(true); }}
                          className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(eng)}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <EngineerForm
          initial={editEngineer ?? undefined}
          onClose={() => { setShowForm(false); setEditEngineer(null); }}
          onSaved={() => {}}
        />
      )}
    </div>
  );
};
