import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlus, Loader2 } from 'lucide-react';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import CameraCapture from '../components/CameraCapture';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  const handleCapture = (file) => setPhotoFile(file);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.email.trim()) return toast.error('Email is required');
    if (!photoFile) return toast.error('Please capture your photo');

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('email', form.email.trim().toLowerCase());
      if (form.phone.trim()) fd.append('phone', form.phone.trim());
      fd.append('photo', photoFile);

      const res = await authApi.register(fd);
      login(res.data.user, res.data.token);
      toast.success('Registered successfully! Welcome aboard.');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">FC</div>
          <h1>Create Account</h1>
          <p>Register with your face for secure attendance</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              placeholder="John Doe"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="john@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label>Phone <span className="optional">(optional)</span></label>
            <input
              type="tel"
              placeholder="+1 234 567 8900"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Face Photo <span className="required">*</span></label>
            <p className="field-hint">Position your face clearly in the frame, good lighting helps</p>
            <CameraCapture
              onCapture={handleCapture}
              label="Capture Registration Photo"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !photoFile}
          >
            {loading ? (
              <><Loader2 size={18} className="spin" /> Processing...</>
            ) : (
              <><UserPlus size={18} /> Create Account</>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
