import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Trash2, Pencil, Check, MessageSquare, AtSign, Hash } from 'lucide-react';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getCurrentUser, getUsers } from '../lib/auth';
import { useProjectNames } from '../lib/useProjectNames';

interface TaskComment {
  id: string;
  task_id: string;
  text: string;
  sender: string;
  username: string;
  createdAt: Timestamp | null;
  mentions?: string[];
}

function renderTextWithMentions(text: string, currentUsername?: string) {
  const parts = text.split(/(@\w+|#\[[^\]]+\])/g);
  return parts.map((part, i) => {
    if (/^@\w+$/.test(part)) {
      const isSelf = currentUsername && part === `@${currentUsername}`;
      return (
        <span
          key={i}
          className={`font-semibold ${isSelf ? 'bg-yellow-200 text-yellow-800 rounded px-0.5' : 'text-emerald-600'}`}
        >
          {part}
        </span>
      );
    }
    if (/^#\[.+\]$/.test(part)) {
      return (
        <span key={i} className="font-semibold text-blue-500">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function extractMentions(text: string): string[] {
  const matches = text.match(/@(\w+)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

interface Props {
  taskId: string;
  taskName: string;
  onClose: () => void;
}

export const TaskCommentSection: React.FC<Props> = ({ taskId, taskName, onClose }) => {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<{ username: string; displayName: string }[]>([]);
  const [projectMentionQuery, setProjectMentionQuery] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const projectNames = useProjectNames();

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentUser = getCurrentUser();

  useEffect(() => {
    setAllUsers(getUsers().map((u) => ({ username: u.username, displayName: u.displayName })));
  }, []);

  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, 'task_comments'),
      where('task_id', '==', taskId),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as TaskComment));
      docs.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return a.createdAt.toMillis() - b.createdAt.toMillis();
      });
      setComments(docs);
    });
    return () => unsubscribe();
  }, [taskId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const filteredUsers =
    mentionQuery !== null
      ? allUsers.filter(
          (u) =>
            u.username.toLowerCase().includes(mentionQuery) ||
            u.displayName.toLowerCase().includes(mentionQuery),
        )
      : [];

  const filteredProjects = projectMentionQuery !== null
    ? projectNames.filter((p) => p.toLowerCase().includes(projectMentionQuery)).slice(0, 6)
    : [];

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    const mentionMatch = val.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1].toLowerCase());
      setProjectMentionQuery(null);
    } else {
      setMentionQuery(null);
      const projMatch = val.match(/#([^#\n]*)$/);
      if (projMatch) {
        setProjectMentionQuery(projMatch[1].toLowerCase());
      } else {
        setProjectMentionQuery(null);
      }
    }
  };

  const insertMention = (username: string) => {
    const newInput = input.replace(/@(\w*)$/, `@${username} `);
    setInput(newInput);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const insertProjectMention = (projectName: string) => {
    const newInput = input.replace(/#([^#\n]*)$/, `#[${projectName}] `);
    setInput(newInput);
    setProjectMentionQuery(null);
    inputRef.current?.focus();
  };

  const sendComment = async () => {
    const text = input.trim();
    if (!text || !db || !currentUser) return;
    setSending(true);
    setSendError(null);
    try {
      const mentions = extractMentions(text);
      await addDoc(collection(db, 'task_comments'), {
        task_id: taskId,
        text,
        sender: currentUser.displayName,
        username: currentUser.username,
        createdAt: serverTimestamp(),
        mentions,
      });
      // Create mention notifications for mentioned users
      const allUsers = getUsers().map((u) => ({ username: u.username, displayName: u.displayName }));
      const expandedMentions = mentions.includes('all')
        ? [...new Set([...allUsers.map((u) => u.username), ...mentions.filter((m) => m !== 'all')])]
        : mentions;
      const uniqueMentions = [...new Set(expandedMentions)].filter((m) => m !== currentUser.username);
      await Promise.all(
        uniqueMentions.map(async (mentionedUsername) => {
          try {
            await addDoc(collection(db, 'mention_notifications'), {
              mentionedUsername,
              mentionerName: currentUser.displayName,
              messageText: text,
              messageId: taskId,
              acknowledged: false,
              source: 'task',
              sourceTitle: taskName,
              createdAt: serverTimestamp(),
            });
          } catch (e) {
            console.error('Failed to create task mention notification:', e);
          }
        }),
      );
      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
      setMentionQuery(null);
      setProjectMentionQuery(null);
    } catch (err) {
      console.error('Error sending comment:', err);
      setSendError('Gửi bình luận thất bại. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!db || !window.confirm('Xóa bình luận này?')) return;
    try {
      await deleteDoc(doc(db, 'task_comments', commentId));
    } catch (err) {
      console.error('Delete error:', err);
      setSendError('Xóa bình luận thất bại.');
    }
  };

  const handleEditStart = (commentId: string, text: string) => {
    setEditingId(commentId);
    setEditText(text);
  };

  const handleEditSave = async (commentId: string) => {
    const text = editText.trim();
    if (!text || !db) return;
    try {
      await updateDoc(doc(db, 'task_comments', commentId), { text });
      setEditingId(null);
      setEditText('');
    } catch (err) {
      console.error('Edit error:', err);
      setSendError('Chỉnh sửa bình luận thất bại.');
    }
  };

  const formatTime = (ts: Timestamp | null) => {
    if (!ts) return '';
    const d = ts.toDate();
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  };

  const canDelete = (comment: TaskComment) =>
    comment.username === currentUser?.username || currentUser?.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative flex flex-col w-full max-w-md bg-white shadow-2xl h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="bg-emerald-500 p-2 rounded-lg flex-shrink-0">
            <MessageSquare className="text-white" size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-sm">Bình luận</h3>
            <p className="text-xs text-slate-500 truncate">{taskName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <MessageSquare size={36} className="opacity-30" />
              <p className="text-sm">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
            </div>
          )}
          {comments.map((comment) => {
            const isMe = comment.username === currentUser?.username;
            const isEditing = editingId === comment.id;
            return (
              <div key={comment.id} className={`flex gap-2 group ${isMe ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isMe ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {comment.sender.charAt(0).toUpperCase()}
                </div>
                <div className={`flex flex-col gap-0.5 max-w-[80%] ${isMe ? 'items-end' : ''}`}>
                  <div className="flex items-center gap-1.5">
                    {!isMe && (
                      <span className="text-xs font-semibold text-slate-600">{comment.sender}</span>
                    )}
                    <span className="text-[10px] text-slate-400">{formatTime(comment.createdAt)}</span>
                    {canDelete(comment) && (
                      <>
                        <button
                          onClick={() => handleEditStart(comment.id, comment.text)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-blue-50 text-slate-300 hover:text-blue-500"
                          title="Chỉnh sửa bình luận"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500"
                          title="Xóa bình luận"
                        >
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="flex gap-1 items-end">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleEditSave(comment.id);
                          }
                          if (e.key === 'Escape') {
                            setEditingId(null);
                            setEditText('');
                          }
                        }}
                        rows={1}
                        className="flex-1 min-w-0 px-2 py-1.5 bg-white border border-blue-400 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm resize-none overflow-hidden"
                        autoFocus
                      />
                      <button
                        onClick={() => handleEditSave(comment.id)}
                        disabled={!editText.trim()}
                        className="flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white p-1.5 rounded-lg transition-all active:scale-95 flex-shrink-0"
                        title="Lưu"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm break-words ${
                        isMe
                          ? 'bg-emerald-500 text-white rounded-tr-sm'
                          : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                      }`}
                    >
                      {renderTextWithMentions(comment.text, currentUser?.username)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-slate-100 flex-shrink-0 p-4 space-y-2">
          {/* @ mention dropdown */}
          {mentionQuery !== null && filteredUsers.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              {filteredUsers.slice(0, 6).map((u) => (
                <button
                  key={u.username}
                  onClick={() => insertMention(u.username)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-emerald-50 text-left text-sm"
                >
                  <AtSign size={14} className="text-emerald-500 flex-shrink-0" />
                  <span className="font-medium text-slate-800">{u.displayName}</span>
                  <span className="text-slate-400 text-xs">@{u.username}</span>
                </button>
              ))}
            </div>
          )}

          {/* # project mention dropdown */}
          {projectMentionQuery !== null && filteredProjects.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              {filteredProjects.map((p) => (
                <button
                  key={p}
                  onClick={() => insertProjectMention(p)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left text-sm"
                >
                  <Hash size={14} className="text-blue-500 flex-shrink-0" />
                  <span className="font-medium text-slate-800">{p}</span>
                </button>
              ))}
            </div>
          )}

          {sendError && <p className="text-xs text-rose-600 font-medium">{sendError}</p>}

          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendComment();
                }
                if (e.key === 'Escape') {
                  setMentionQuery(null);
                  setProjectMentionQuery(null);
                }
              }}
              placeholder="Viết bình luận... (dùng @ để nhắc ai đó, # để nhắc công việc)"
              disabled={!db || !currentUser || sending}
              rows={1}
              className="flex-1 min-w-0 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm resize-none overflow-hidden"
            />
            <button
              onClick={sendComment}
              disabled={sending || !input.trim() || !db || !currentUser}
              className="flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white p-2.5 rounded-xl font-medium transition-all active:scale-95 flex-shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
