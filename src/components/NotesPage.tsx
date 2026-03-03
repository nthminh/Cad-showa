import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  Pin,
  Image as ImageIcon,
  Video,
  X,
  Search,
  Palette,
  Check,
  Link,
} from 'lucide-react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { getCurrentUser } from '../lib/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Note {
  id: string;
  username: string;
  title: string;
  content: string;
  images: string[];
  videoUrl: string;
  color: string;
  isPinned: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTE_COLORS = [
  { name: 'Mặc định', value: 'bg-white', border: 'border-slate-200', text: 'text-slate-900' },
  { name: 'Đỏ', value: 'bg-red-50', border: 'border-red-200', text: 'text-red-900' },
  { name: 'Cam', value: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900' },
  { name: 'Vàng', value: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900' },
  { name: 'Xanh lá', value: 'bg-green-50', border: 'border-green-200', text: 'text-green-900' },
  { name: 'Xanh lam', value: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900' },
  { name: 'Tím', value: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900' },
  { name: 'Hồng', value: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-900' },
];

// Extract YouTube video ID from various URL formats
function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];
  for (const pattern of patterns) {
    const m = url.match(pattern);
    if (m) return m[1];
  }
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ColorPickerProps {
  current: string;
  onChange: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ current, onChange }) => (
  <div className="flex flex-wrap gap-1.5 p-2">
    {NOTE_COLORS.map((c) => (
      <button
        key={c.value}
        type="button"
        title={c.name}
        onClick={() => onChange(c.value)}
        className={`w-6 h-6 rounded-full border-2 ${c.value} ${current === c.value ? 'border-slate-600 scale-110' : 'border-transparent hover:border-slate-400'} transition-all`}
      />
    ))}
  </div>
);

// Get color config for a given bg value
function getColorConfig(value: string) {
  return NOTE_COLORS.find((c) => c.value === value) ?? NOTE_COLORS[0];
}

// ─── NoteCard ─────────────────────────────────────────────────────────────────

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onEdit, onDelete, onTogglePin }) => {
  const [showActions, setShowActions] = useState(false);
  const cc = getColorConfig(note.color);
  const ytId = getYouTubeId(note.videoUrl);

  return (
    <div
      className={`relative rounded-2xl border ${cc.value} ${cc.border} shadow-sm group cursor-pointer transition-shadow hover:shadow-md break-inside-avoid mb-4`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={() => onEdit(note)}
    >
      {/* Images */}
      {note.images.length > 0 && (
        <div className={`grid ${note.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-0.5 rounded-t-2xl overflow-hidden`}>
          {note.images.slice(0, 4).map((url, i) => (
            <div key={i} className="relative">
              <img
                src={url}
                alt=""
                className={`w-full object-cover ${note.images.length === 1 ? 'max-h-52' : 'h-28'}`}
              />
              {i === 3 && note.images.length > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white font-bold text-xl">+{note.images.length - 4}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* YouTube embed thumbnail */}
      {ytId && note.images.length === 0 && (
        <div className="rounded-t-2xl overflow-hidden">
          <img
            src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
            alt="video thumbnail"
            className="w-full object-cover max-h-40"
          />
        </div>
      )}

      <div className="p-4">
        {note.title && (
          <h3 className={`font-semibold text-base mb-1 ${cc.text}`}>{note.title}</h3>
        )}
        {note.content && (
          <p className={`text-sm whitespace-pre-wrap line-clamp-6 ${cc.text} opacity-80`}>{note.content}</p>
        )}
        {note.videoUrl && !ytId && (
          <a
            href={note.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline truncate"
          >
            <Link size={12} />
            {note.videoUrl}
          </a>
        )}
      </div>

      {/* Pin button always visible when pinned */}
      <button
        type="button"
        title={note.isPinned ? 'Bỏ ghim' : 'Ghim ghi chú'}
        onClick={(e) => { e.stopPropagation(); onTogglePin(note.id, note.isPinned); }}
        className={`absolute top-2 right-2 p-1.5 rounded-full transition-all ${note.isPinned ? 'text-amber-500 opacity-100' : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-amber-500'} hover:bg-black/5`}
      >
        {note.isPinned ? <Pin size={16} fill="currentColor" /> : <Pin size={16} />}
      </button>

      {/* Action toolbar */}
      <div
        className={`absolute bottom-2 right-2 flex items-center gap-0.5 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}
      >
        <button
          type="button"
          title="Chỉnh sửa"
          onClick={(e) => { e.stopPropagation(); onEdit(note); }}
          className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-black/5"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          title="Xóa ghi chú"
          onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
          className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

// ─── NoteEditor Modal ─────────────────────────────────────────────────────────

interface NoteEditorProps {
  note: Partial<Note> | null;
  onSave: (data: Partial<Note>) => Promise<void>;
  onClose: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ note, onSave, onClose }) => {
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [images, setImages] = useState<string[]>(note?.images ?? []);
  const [videoUrl, setVideoUrl] = useState(note?.videoUrl ?? '');
  const [color, setColor] = useState(note?.color ?? 'bg-white');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [videoInputVal, setVideoInputVal] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cc = getColorConfig(color);

  const handleImageUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!storage) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
    const path = `notes/${Date.now()}_${crypto.randomUUID()}_${file.name}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      urls.push(url);
    }
    setImages((prev) => [...prev, ...urls]);
    setUploading(false);
  }, []);

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const addVideoUrl = () => {
    const v = videoInputVal.trim();
    if (v) { setVideoUrl(v); setVideoInputVal(''); setShowVideoInput(false); }
  };

  const handleSave = async () => {
    const isEmpty = !title.trim() && !content.trim() && images.length === 0 && !videoUrl;
    if (isEmpty) {
      // If editing an existing note with all fields cleared, delete it
      if (note?.id && db) {
        if (window.confirm('Ghi chú trống sẽ bị xóa. Tiếp tục?')) {
          await deleteDoc(doc(db, 'notes', note.id));
        }
      }
      onClose();
      return;
    }
    setSaving(true);
    await onSave({ title: title.trim(), content: content.trim(), images, videoUrl, color });
    setSaving(false);
    onClose();
  };

  const ytId = getYouTubeId(videoUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={handleSave}>
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${cc.value} ${cc.border}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image strip */}
        {images.length > 0 && (
          <div className={`grid ${images.length > 1 ? 'grid-cols-3' : 'grid-cols-1'} gap-0.5`}>
            {images.map((url, i) => (
              <div key={i} className="relative group/img">
                <img src={url} alt="" className="w-full h-32 object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* YouTube embed */}
        {ytId && (
          <div className="relative aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${ytId}`}
              title="YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
            <button
              type="button"
              onClick={() => setVideoUrl('')}
              className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Non-YouTube video link */}
        {videoUrl && !ytId && (
          <div className="flex items-center gap-2 px-4 pt-3">
            <Link size={14} className="text-blue-500 flex-shrink-0" />
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline truncate flex-1"
            >
              {videoUrl}
            </a>
            <button type="button" onClick={() => setVideoUrl('')} className="text-slate-400 hover:text-slate-700">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Title */}
        <input
          type="text"
          placeholder="Tiêu đề"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`w-full px-4 pt-4 pb-1 text-base font-semibold bg-transparent border-none outline-none placeholder-slate-400 ${cc.text}`}
        />

        {/* Content */}
        <textarea
          placeholder="Ghi chú của bạn..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className={`w-full px-4 py-2 text-sm bg-transparent border-none outline-none resize-none placeholder-slate-400 ${cc.text} opacity-90`}
        />

        {/* Video URL input */}
        {showVideoInput && (
          <div className="flex items-center gap-2 px-4 pb-2">
            <input
              type="url"
              placeholder="Dán link video (YouTube, v.v.)"
              value={videoInputVal}
              onChange={(e) => setVideoInputVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addVideoUrl(); if (e.key === 'Escape') setShowVideoInput(false); }}
              className={`flex-1 text-sm px-3 py-1.5 rounded-lg border ${cc.border} bg-white/60 outline-none`}
              autoFocus
            />
            <button type="button" onClick={addVideoUrl} className="p-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600">
              <Check size={14} />
            </button>
            <button type="button" onClick={() => setShowVideoInput(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className={`flex items-center justify-between px-2 py-2 border-t ${cc.border}`}>
          <div className="flex items-center gap-0.5">
            {/* Image upload */}
            <button
              type="button"
              title="Chèn ảnh"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              className="p-2 rounded-full text-slate-500 hover:bg-black/5 hover:text-slate-700 disabled:opacity-50"
            >
              {uploading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <ImageIcon size={18} />
              )}
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleImageUpload(e.target.files)} />

            {/* Video link */}
            <button
              type="button"
              title="Chèn link video"
              onClick={() => setShowVideoInput((v) => !v)}
              className={`p-2 rounded-full hover:bg-black/5 hover:text-slate-700 ${showVideoInput ? 'text-blue-500' : 'text-slate-500'}`}
            >
              <Video size={18} />
            </button>

            {/* Color picker */}
            <div className="relative">
              <button
                type="button"
                title="Màu sắc"
                onClick={() => setShowColorPicker((v) => !v)}
                className={`p-2 rounded-full hover:bg-black/5 hover:text-slate-700 ${showColorPicker ? 'text-emerald-500' : 'text-slate-500'}`}
              >
                <Palette size={18} />
              </button>
              {showColorPicker && (
                <div className={`absolute bottom-10 left-0 rounded-2xl border shadow-lg ${cc.value} ${cc.border} z-10`}>
                  <ColorPicker current={color} onChange={(c) => { setColor(c); setShowColorPicker(false); }} />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-slate-600 hover:bg-black/5 rounded-lg"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60"
            >
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Inline Create Note ────────────────────────────────────────────────────────

interface InlineCreateProps {
  onOpenEditor: () => void;
}

const InlineCreate: React.FC<InlineCreateProps> = ({ onOpenEditor }) => (
  <div
    className="w-full max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm px-5 py-3.5 flex items-center gap-3 cursor-text hover:shadow-md transition-shadow mb-8"
    onClick={onOpenEditor}
  >
    <span className="flex-1 text-sm text-slate-400 select-none">Tạo ghi chú mới...</span>
    <div className="flex items-center gap-2 text-slate-400">
      <ImageIcon size={18} />
      <Video size={18} />
    </div>
  </div>
);

// ─── Main NotesPage ───────────────────────────────────────────────────────────

const NotesPage: React.FC = () => {
  const currentUser = getCurrentUser();
  const username = currentUser?.username ?? '';

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNote, setEditingNote] = useState<Partial<Note> | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Subscribe to notes for this user
  useEffect(() => {
    if (!db || !username) { setLoading(false); return; }
    const q = query(
      collection(db, 'notes'),
      where('username', '==', username),
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Note))
        .sort((a, b) => {
          if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
          const aTime = a.updatedAt?.toMillis() ?? 0;
          const bTime = b.updatedAt?.toMillis() ?? 0;
          return bTime - aTime;
        });
      setNotes(data);
      setLoading(false);
    }, (error) => {
      console.error('Lỗi tải ghi chú:', error);
      setLoading(false);
    });
    return () => unsub();
  }, [username]);

  const openCreate = () => {
    setEditingNote({});
    setIsEditorOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  const handleSave = async (data: Partial<Note>) => {
    if (!db) return;
    if (editingNote?.id) {
      // Update existing
      await updateDoc(doc(db, 'notes', editingNote.id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create new
      await addDoc(collection(db, 'notes'), {
        username,
        title: data.title ?? '',
        content: data.content ?? '',
        images: data.images ?? [],
        videoUrl: data.videoUrl ?? '',
        color: data.color ?? 'bg-white',
        isPinned: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !window.confirm('Xóa ghi chú này?')) return;
    await deleteDoc(doc(db, 'notes', id));
  };

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    if (!db) return;
    await updateDoc(doc(db, 'notes', id), { isPinned: !isPinned, updatedAt: serverTimestamp() });
  };

  const filteredNotes = notes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  const pinnedNotes = filteredNotes.filter((n) => n.isPinned);
  const unpinnedNotes = filteredNotes.filter((n) => !n.isPinned);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Search bar */}
      <div className="relative mb-6 max-w-xl mx-auto">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm kiếm ghi chú..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-white shadow-sm text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Create note */}
      <InlineCreate onOpenEditor={openCreate} />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <svg className="animate-spin w-8 h-8 mr-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Đang tải ghi chú...
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Pin size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">
            {searchQuery ? 'Không tìm thấy ghi chú nào.' : 'Chưa có ghi chú nào. Hãy tạo ghi chú đầu tiên!'}
          </p>
        </div>
      ) : (
        <div>
          {/* Pinned */}
          {pinnedNotes.length > 0 && (
            <section className="mb-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Pin size={12} />
                Đã ghim
              </p>
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
                {pinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Unpinned */}
          {unpinnedNotes.length > 0 && (
            <section>
              {pinnedNotes.length > 0 && (
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  Các ghi chú khác
                </p>
              )}
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
                {unpinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Floating Add button (mobile) */}
      <button
        type="button"
        onClick={openCreate}
        className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-emerald-600 transition-colors lg:hidden z-20"
        title="Tạo ghi chú mới"
      >
        <Plus size={24} />
      </button>

      {/* Editor modal */}
      {isEditorOpen && (
        <NoteEditor
          note={editingNote}
          onSave={handleSave}
          onClose={() => { setIsEditorOpen(false); setEditingNote(null); }}
        />
      )}
    </div>
  );
};

export default NotesPage;