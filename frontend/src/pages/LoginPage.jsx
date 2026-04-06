import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn, Loader2 } from 'lucide-react';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import CameraCapture from '../components/CameraCapture';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [email, setEmail] = useState('');

  const handleCapture = (file) => setPhotoFile(file);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error('Email is required');
    if (!photoFile) return toast.error('Please capture your face photo');

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('email', email.trim().toLowerCase());
      fd.append('photo', photoFile);

      const res = await authApi.login(fd);
      login(res.data.user, res.data.token);
      toast.success(`Welcome back, ${res.data.user.name}! Match: ${(res.data.similarity * 100).toFixed(1)}%`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
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
          <h1>Sign In</h1>
          <p>Verify your identity with face recognition</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label>Face Verification <span className="required">*</span></label>
            <p className="field-hint">Look directly at the camera in good lighting</p>
            <CameraCapture
              onCapture={handleCapture}
              label="Capture Face to Login"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !photoFile}
          >
            {loading ? (
              <><Loader2 size={18} className="spin" /> Verifying face...</>
            ) : (
              <><LogIn size={18} /> Sign In</>
            )}
          </button>
        </form>

        <div className="auth-footer">
          No account yet? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}
