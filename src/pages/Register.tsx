import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

interface Hostel {
  id: number;
  name: string;
}

interface Wing {
  id: number;
  name: string;
}

export default function Register() {
  const [formData, setFormData] = useState({
    full_name: '',
    uid: '',
    phone: '',
    password: '',
    confirmPassword: '',
    hostel_id: '',
    wing_id: ''
  });
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [wings, setWings] = useState<Wing[]>([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchHostels();
  }, []);

  useEffect(() => {
    if (formData.hostel_id) {
      fetchWings(formData.hostel_id);
    } else {
      setWings([]);
    }
  }, [formData.hostel_id]);

  const fetchHostels = async () => {
    try {
      const res = await fetch('/api/hostels');
      if (res.ok) setHostels(await res.json());
    } catch (err) {
      console.error("Failed to fetch hostels");
    }
  };

  const fetchWings = async (hostelId: string) => {
    try {
      const res = await fetch(`/api/hostels/${hostelId}/wings`);
      if (res.ok) setWings(await res.json());
    } catch (err) {
      console.error("Failed to fetch wings");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match");
      toast.error("Passwords don't match");
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.full_name,
          uid: formData.uid,
          phone: formData.phone,
          password: formData.password,
          hostel_id: formData.hostel_id,
          wing_id: formData.wing_id
        }),
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
        throw new Error(data.error || 'Registration failed');
      }

      toast.success(data.message || 'Registration successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-display">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-cu-navy p-6 text-center">
          <h2 className="text-white font-bold text-xl uppercase tracking-widest">Student Registration</h2>
          <p className="text-white/70 text-xs mt-1">Create your gym account</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-xs p-3 rounded border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-cu-maroon uppercase tracking-wide">Full Name</label>
            <input
              name="full_name"
              type="text"
              value={formData.full_name}
              onChange={handleChange}
              className="w-full h-10 px-3 border-2 border-slate-200 rounded-lg focus:border-cu-navy focus:ring-0 text-sm"
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-cu-maroon uppercase tracking-wide">University UID</label>
            <input
              name="uid"
              type="text"
              value={formData.uid}
              onChange={handleChange}
              className="w-full h-10 px-3 border-2 border-slate-200 rounded-lg focus:border-cu-navy focus:ring-0 text-sm"
              placeholder="e.g. 23BCS..."
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-cu-maroon uppercase tracking-wide">Phone Number</label>
            <input
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className="w-full h-10 px-3 border-2 border-slate-200 rounded-lg focus:border-cu-navy focus:ring-0 text-sm"
              placeholder="+91..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-cu-maroon uppercase tracking-wide">Hostel</label>
              <select
                name="hostel_id"
                value={formData.hostel_id}
                onChange={handleChange}
                className="w-full h-10 px-3 border-2 border-slate-200 rounded-lg focus:border-cu-navy focus:ring-0 text-sm bg-white"
                required
              >
                <option value="">Select Hostel</option>
                {hostels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-cu-maroon uppercase tracking-wide">Wing</label>
              <select
                name="wing_id"
                value={formData.wing_id}
                onChange={handleChange}
                className="w-full h-10 px-3 border-2 border-slate-200 rounded-lg focus:border-cu-navy focus:ring-0 text-sm bg-white"
                required
                disabled={!formData.hostel_id}
              >
                <option value="">Select Wing</option>
                {wings.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-cu-maroon uppercase tracking-wide">Password</label>
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full h-10 px-3 border-2 border-slate-200 rounded-lg focus:border-cu-navy focus:ring-0 text-sm"
              placeholder="Create password"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-cu-maroon uppercase tracking-wide">Confirm Password</label>
            <input
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full h-10 px-3 border-2 border-slate-200 rounded-lg focus:border-cu-navy focus:ring-0 text-sm"
              placeholder="Confirm password"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full h-12 bg-cu-maroon hover:bg-red-900 text-white font-bold rounded-lg uppercase tracking-widest text-sm shadow-lg shadow-cu-maroon/20 mt-2 transition-all active:scale-[0.98]"
          >
            Register
          </button>

          <div className="text-center text-xs text-slate-500">
            Already have an account? <Link to="/login" className="text-cu-navy font-bold hover:underline">Login here</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
