import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Calendar, CheckCircle2, Clock, LogOut, Camera,
  TrendingUp, Users, ChevronLeft, ChevronRight,
  Loader2, X, BarChart3, User
} from 'lucide-react';
import { attendanceApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import CameraCapture from '../components/CameraCapture';
import { format, parseISO } from 'date-fns';

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className={`stat-card stat-${accent}`}>
      <div className="stat-icon"><Icon size={20} /></div>
      <div className="stat-content">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function MarkAttendanceModal({ onClose, onSuccess }) {
  const [photoFile, setPhotoFile] = useState(null);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!photoFile) return toast.error('Please capture your photo first');

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('photo', photoFile);
      fd.append('date', date);
      const res = await attendanceApi.mark(fd);
      toast.success(`Attendance marked! Confidence: ${(res.data.similarity * 100).toFixed(1)}%`);
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to mark attendance';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2><Camera size={20} /> Mark Attendance</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Verify Your Face</label>
            <p className="field-hint">Look at the camera clearly</p>
            <CameraCapture
              onCapture={file => setPhotoFile(file)}
              label="Capture Photo"
              disabled={loading}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !photoFile}>
              {loading
                ? <><Loader2 size={16} className="spin" /> Verifying...</>
                : <><CheckCircle2 size={16} /> Confirm Attendance</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AttendanceRow({ record }) {
  const dateStr = format(parseISO(record.date), 'EEE, MMM d yyyy');
  const timeStr = format(parseISO(record.checkedInAt), 'hh:mm a');
  const pct = record.similarity ? (record.similarity * 100).toFixed(1) : null;

  return (
    <div className="attendance-row">
      <div className="att-date">
        <Calendar size={14} />
        {dateStr}
      </div>
      <div className="att-time">
        <Clock size={14} />
        {timeStr}
      </div>
      <div className={`att-status status-${record.status.toLowerCase()}`}>
        {record.status}
      </div>
      {pct && (
        <div className="att-confidence">
          <div className="conf-bar">
            <div className="conf-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span>{pct}%</span>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [attendance, setAttendance] = useState({ records: [], total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, attRes] = await Promise.all([
        attendanceApi.getStats(),
        attendanceApi.getMy(page),
      ]);
      setStats(statsRes.data);
      setAttendance(attRes.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Signed out');
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">FC</span>
          <span className="brand-name">FaceCheck</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-item active">
            <BarChart3 size={18} />
            <span>Dashboard</span>
          </div>
          <div className="nav-item">
            <User size={18} />
            <span>{user?.name || 'Profile'}</span>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋</h1>
            <p className="page-subtitle">Here's your attendance overview</p>
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Camera size={18} />
            Mark Attendance
          </button>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <StatCard icon={CheckCircle2} label="Total Present" value={loading ? '—' : stats?.total ?? 0} accent="green" />
          <StatCard icon={Calendar} label="This Month" value={loading ? '—' : stats?.thisMonth ?? 0} accent="blue" />
          <StatCard icon={TrendingUp} label="This Week" value={loading ? '—' : stats?.thisWeek ?? 0} accent="purple" />
          <StatCard icon={Clock} label="Today" value={loading ? '—' : (stats?.recent?.[0] && isToday(stats.recent[0].date) ? '✓' : '—')} accent="orange" />
        </div>

        {/* Attendance History */}
        <div className="section-card">
          <div className="section-header">
            <h2>Attendance History</h2>
            <span className="badge">{attendance.total} total</span>
          </div>

          {loading ? (
            <div className="loading-state">
              <Loader2 size={24} className="spin" />
              <p>Loading records...</p>
            </div>
          ) : attendance.records.length === 0 ? (
            <div className="empty-state">
              <Calendar size={40} />
              <p>No attendance records yet</p>
              <small>Click "Mark Attendance" to get started</small>
            </div>
          ) : (
            <>
              <div className="attendance-list">
                {attendance.records.map(r => (
                  <AttendanceRow key={r.id} record={r} />
                ))}
              </div>

              {attendance.totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <span>Page {page} of {attendance.totalPages}</span>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => setPage(p => Math.min(attendance.totalPages, p + 1))}
                    disabled={page === attendance.totalPages}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {showModal && (
        <MarkAttendanceModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function isToday(dateStr) {
  const today = format(new Date(), 'yyyy-MM-dd');
  return dateStr?.startsWith(today);
}
