import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [uid, setUid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Forgot Password State
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) {
      setError('Please enter User Id');
      return;
    }
    if (!password) {
      setError('Please enter Password');
      return;
    }
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, password }),
      });

      const contentType = res.headers.get("content-type");
      let data;
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error("Server Error (Non-JSON):", text);
        throw new Error("Server error: Please check console for details.");
      }

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      login(data.user);

      if (data.user.role === 'admin') {
        navigate('/admin');
      } else if (data.user.role === 'manager') {
        navigate('/manager');
      } else {
        navigate('/student');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !phone || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setMsg('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, phone, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');

      setMsg(data.message);
      setTimeout(() => {
        setIsForgotPassword(false);
        setMsg('');
        setPassword('');
        setPhone('');
        setNewPassword('');
        setConfirmPassword('');
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center font-display relative"
      style={{
        backgroundImage: `url('/cu-bg.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Dark tint overlay */}
      <div className="absolute inset-0 bg-black/60"></div>

      {/* Header text floating above */}
      <div className="relative z-10 text-center mb-8 drop-shadow-md">
        <h1 className="text-white text-4xl md:text-5xl font-bold font-oswald tracking-wide">
          India's <span className="text-red-500">Next-Gen</span>
        </h1>
        <h1 className="text-white text-4xl md:text-5xl font-bold font-oswald tracking-wide mt-2">
          Futuristic University
        </h1>
      </div>

      {/* Glassmorphism Login Card */}
      <div className="relative z-10 w-full max-w-md bg-[#1a1a1a]/80 backdrop-blur-md p-8 md:p-10 rounded-3xl shadow-2xl border border-white/10">

        {/* Logo Replacement Area */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white text-2xl font-bold font-oswald">CU</div>
            <div className="text-white text-3xl font-bold tracking-widest font-oswald">Unnao</div>
          </div>
          <p className="text-white text-[16px] tracking-widest uppercase mt-1">Hostel Gym Portal</p>
        </div>

        <h2 className="text-white text-center font-bold text-2xl tracking-widest mb-4">
          {isForgotPassword ? 'RESET PASSWORD' : 'LOGIN'}
        </h2>

        {!isForgotPassword && (
          <p className="text-center text-sm text-slate-300 mb-8 px-4">
            Welcome to Hostel GYM<br />Management System - Unnao Campus
          </p>
        )}

        <form onSubmit={isForgotPassword ? handleResetPassword : handleLoginSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/20 text-red-200 text-xs p-3 rounded border border-red-500/30 text-center">
              {error}
            </div>
          )}
          {msg && (
            <div className="bg-green-500/20 text-green-200 text-xs p-3 rounded border border-green-500/30 text-center">
              {msg}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                className="w-full h-12 bg-[#2a2a2a] text-white px-4 rounded-xl border border-transparent focus:border-red-500 focus:outline-none transition-colors"
                placeholder="Enter User Id"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-xl">account_circle</span>
            </div>

            {!isForgotPassword ? (
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 bg-[#2a2a2a] text-white px-4 rounded-xl border border-transparent focus:border-red-500 focus:outline-none transition-colors"
                  placeholder="Enter Password"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-xl">key</span>
              </div>
            ) : (
              <>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-12 bg-[#2a2a2a] text-white px-4 rounded-xl border border-transparent focus:border-red-500 focus:outline-none transition-colors"
                    placeholder="Enter Registered Phone No"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-xl">call</span>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-12 bg-[#2a2a2a] text-white px-4 rounded-xl border border-transparent focus:border-red-500 focus:outline-none transition-colors"
                    placeholder="New Password"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-xl">lock_reset</span>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-12 bg-[#2a2a2a] text-white px-4 rounded-xl border border-transparent focus:border-red-500 focus:outline-none transition-colors"
                    placeholder="Confirm New Password"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-xl">password</span>
                </div>
              </>
            )}
          </div>

          <div className="pt-2">
            {!isForgotPassword ? (
              <>
                <button
                  type="submit"
                  className="w-full h-12 bg-[#e20000] hover:bg-red-700 text-white font-bold rounded-full uppercase tracking-widest text-sm transition-colors shadow-[0_0_15px_rgba(226,0,0,0.3)] hover:shadow-[0_0_20px_rgba(226,0,0,0.5)]"
                >
                  LOGIN
                </button>
                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setError(''); setMsg(''); }}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>

                <div className="relative flex py-5 items-center">
                  <div className="flex-grow border-t border-white/20"></div>
                  <span className="flex-shrink-0 mx-4 text-white/50 text-xs uppercase font-bold">OR</span>
                  <div className="flex-grow border-t border-white/20"></div>
                </div>

                <Link
                  to="/register"
                  className="w-full h-12 bg-[#5d9dff] hover:bg-blue-500 text-white font-bold rounded-full uppercase tracking-widest text-sm transition-colors flex items-center justify-center shadow-[0_0_15px_rgba(93,157,255,0.3)] hover:shadow-[0_0_20px_rgba(93,157,255,0.5)]"
                >
                  CLICK HERE FOR REGISTRATION
                </Link>
              </>
            ) : (
              <>
                <button
                  type="submit"
                  className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full uppercase tracking-widest text-sm transition-colors shadow-[0_0_15px_rgba(22,163,74,0.3)] hover:shadow-[0_0_20px_rgba(22,163,74,0.5)]"
                >
                  RESET PASSWORD
                </button>
                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setIsForgotPassword(false); setError(''); setMsg(''); }}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Back to Login
                  </button>
                </div>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
