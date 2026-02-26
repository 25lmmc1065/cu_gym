import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface User {
  id: number;
  full_name: string;
  uid: string;
  phone: string;
  is_verified: number;
  is_blocked: number;
  block_reason?: string;
  created_at: string;
  hostel_name?: string;
  wing_name?: string;
}

interface Stats {
  totalStudents: number;
  totalBookings: number;
  pendingVerifications: number;
}

interface ShiftData {
  id: number;
  start_time: string;
  end_time: string;
  label: string;
  type: 'morning' | 'evening';
  bookings: {
    booking_id: number;
    status: 'booked' | 'attended' | 'absent' | 'cancelled' | 'waitlisted';
    cancellation_reason?: string;
    full_name: string;
    uid: string;
    phone: string;
  }[];
}

// ...

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'analytics' | 'slots' | 'profile'>('dashboard');
  const [stats, setStats] = useState<Stats>({ totalStudents: 0, totalBookings: 0, pendingVerifications: 0 });
  const [shifts, setShifts] = useState<ShiftData[]>([]);
  const [shiftFilter, setShiftFilter] = useState<'morning' | 'evening'>('morning');
  const [users, setUsers] = useState<User[]>([]);
  const [userFilter, setUserFilter] = useState<'all' | 'pending'>('pending');
  const [analytics, setAnalytics] = useState<{ stats: any, logs: any[] } | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Slots Management State
  const [slots, setSlots] = useState<any[]>([]);
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [slotForm, setSlotForm] = useState<{
    start_time: string;
    end_time: string;
    capacity: number;
    label: string;
    type: 'morning' | 'evening';
  }>({
    start_time: '',
    end_time: '',
    capacity: 15,
    label: '',
    type: 'morning'
  });

  // Modal State
  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean, bookingId: number | null }>({ isOpen: false, bookingId: null });
  const [cancelReason, setCancelReason] = useState('');

  const [blockModal, setBlockModal] = useState<{ isOpen: boolean, userId: number | null }>({ isOpen: false, userId: null });
  const [blockReason, setBlockReason] = useState('');

  // Profile State
  const [wardenProfile, setWardenProfile] = useState<any>(null);

  useEffect(() => {
    fetchStats();
    fetchShifts();
    fetchSlots();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'analytics') {
      fetchAnalytics();
    } else if (activeTab === 'slots') {
      fetchSlots();
    } else if (activeTab === 'profile') {
      fetchProfile();
    }
  }, [activeTab, userFilter]);

  // Fetch shifts whenever date changes
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchShifts();
    }
  }, [selectedDate]);

  const fetchStats = async () => {
    const res = await fetch('/api/admin/stats');
    if (res.ok) setStats(await res.json());
  };

  const fetchShifts = async () => {
    const res = await fetch(`/api/admin/shifts?date=${selectedDate}`);
    if (res.ok) setShifts(await res.json());
  };

  const fetchAnalytics = async () => {
    const res = await fetch('/api/admin/analytics');
    if (res.ok) setAnalytics(await res.json());
  };

  const fetchProfile = async () => {
    try {
      console.log("Fetching profile...");
      const res = await fetch('/api/admin/profile');
      console.log("Profile response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("Profile data received:", data);
        setWardenProfile(data);
      } else {
        const errData = await res.json();
        console.error("Failed to fetch profile (res not ok)", errData);
      }
    } catch (err) {
      console.error("Failed to fetch profile (network error)", err);
    }
  };

  const fetchSlots = async () => {
    try {
      const res = await fetch('/api/slots');
      if (res.ok) {
        setSlots(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch slots", err);
    }
  };

  const handleSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingSlot ? `/api/admin/slots/${editingSlot.id}` : '/api/admin/slots';
    const method = editingSlot ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slotForm),
      });

      if (res.ok) {
        setIsSlotModalOpen(false);
        setEditingSlot(null);
        setSlotForm({ start_time: '', end_time: '', capacity: 15, label: '', type: 'morning' });
        fetchSlots();
        alert(editingSlot ? "Slot updated successfully" : "Slot created successfully");
      } else {
        const data = await res.json();
        alert(data.error || "Operation failed");
      }
    } catch (err) {
      console.error("Slot operation failed", err);
    }
  };

  const handleDeleteSlot = async (id: number) => {
    if (!confirm("Are you sure you want to delete this slot?")) return;

    try {
      const res = await fetch(`/api/admin/slots/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSlots();
        alert("Slot deleted successfully");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete slot");
      }
    } catch (err) {
      console.error("Failed to delete slot", err);
    }
  };

  const openEditSlot = (slot: any) => {
    setEditingSlot(slot);
    setSlotForm({
      start_time: slot.start_time,
      end_time: slot.end_time,
      capacity: slot.capacity,
      label: slot.label,
      type: slot.type || 'morning'
    });
    setIsSlotModalOpen(true);
  };

  const openCreateSlot = () => {
    setEditingSlot(null);
    setSlotForm({ start_time: '', end_time: '', capacity: 15, label: '', type: 'morning' });
    setIsSlotModalOpen(true);
  };

  const updateBookingStatus = async (bookingId: number, status: string, reason?: string) => {
    try {
      const res = await fetch('/api/admin/booking/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, status, reason }),
      });

      if (res.ok) {
        fetchShifts();
        fetchStats();
        if (status === 'cancelled') closeCancelModal();
      }
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const toggleBlockUser = async (userId: number, isBlocked: boolean, reason?: string) => {
    try {
      const res = await fetch('/api/admin/users/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, is_blocked: isBlocked, reason }),
      });

      if (res.ok) {
        fetchUsers();
        if (isBlocked) closeBlockModal();
      }
    } catch (err) {
      console.error("Failed to block user", err);
    }
  };

  const openCancelModal = (bookingId: number) => {
    setCancelModal({ isOpen: true, bookingId });
    setCancelReason('');
  };

  const closeCancelModal = () => {
    setCancelModal({ isOpen: false, bookingId: null });
    setCancelReason('');
  };

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cancelModal.bookingId) {
      updateBookingStatus(cancelModal.bookingId, 'cancelled', cancelReason);
    }
  };

  const openBlockModal = (userId: number) => {
    setBlockModal({ isOpen: true, userId });
    setBlockReason('');
  };

  const closeBlockModal = () => {
    setBlockModal({ isOpen: false, userId: null });
    setBlockReason('');
  };

  const handleBlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (blockModal.userId) {
      toggleBlockUser(blockModal.userId, true, blockReason);
    }
  };

  const fetchUsers = async () => {
    try {
      console.log(`Fetching users with filter: ${userFilter}`);
      const res = await fetch(`/api/admin/users?filter=${userFilter}`);
      if (res.ok) {
        const data = await res.json();
        console.log("Users fetched:", data);
        setUsers(data);
      } else {
        console.error("Failed to fetch users:", res.status);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const verifyUser = async (userId: number) => {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) {
      fetchUsers();
      fetchStats();
    }
  };

  return (
    <div className="font-display text-slate-900 bg-white flex flex-col min-h-screen">
      {/* Top Bar */}
      <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">lock</span>
          Secure Portal
        </div>
        <div className="flex items-center gap-2">
          <span>Admin: {user?.name}</span>
          <button onClick={logout} className="text-cu-maroon hover:underline">Logout</button>
        </div>
      </div>

      {/* Header */}
      <header className="bg-cu-navy sticky top-0 z-30 px-4 py-4 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-cu-navy">fitness_center</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-sm tracking-tight">Trainer Admin Panel</h1>
              <p className="text-white/70 text-[10px]">Hostel Gym Management</p>
            </div>
          </div>
          <button onClick={() => window.print()} className="bg-cu-maroon text-white text-[10px] font-bold py-2 px-3 rounded flex items-center gap-1 shadow-sm uppercase tracking-wider">
            <span className="material-symbols-outlined text-xs">print</span>
            Print Daily List
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="bg-cu-maroon w-14 flex flex-col items-center py-6 gap-6 shrink-0">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`material-symbols-outlined text-xl ${activeTab === 'dashboard' ? 'text-white' : 'text-white/50'}`}
            title="Dashboard"
          >
            dashboard
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`material-symbols-outlined text-xl relative ${activeTab === 'users' ? 'text-white' : 'text-white/50'}`}
            title="Users"
          >
            group
            {stats.pendingVerifications > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full border-2 border-cu-maroon"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`material-symbols-outlined text-xl ${activeTab === 'analytics' ? 'text-white' : 'text-white/50'}`}
            title="Analytics"
          >
            analytics
          </button>
          <button
            onClick={() => setActiveTab('slots')}
            className={`material-symbols-outlined text-xl ${activeTab === 'slots' ? 'text-white' : 'text-white/50'}`}
            title="Manage Slots"
          >
            settings
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`material-symbols-outlined text-xl ${activeTab === 'profile' ? 'text-white' : 'text-white/50'}`}
            title="My Profile"
          >
            account_circle
          </button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24 bg-white">

          {activeTab === 'dashboard' && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Total Bookings</div>
                  <div className="text-2xl font-bold text-cu-navy">{stats.totalBookings}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Pending Users</div>
                  <div className="text-2xl font-bold text-yellow-600">{stats.pendingVerifications}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Total Students</div>
                  <div className="text-2xl font-bold text-slate-700">{stats.totalStudents}</div>
                </div>
              </div>

              <div className="relative mb-6 flex items-center gap-4">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-cu-maroon/20 focus:border-cu-maroon" placeholder="Search by UID (e.g. 23BCS...)" type="text" />
                </div>
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg py-3 px-4 text-sm font-bold text-cu-navy focus:ring-2 focus:ring-cu-maroon/20 focus:border-cu-maroon"
                  />
                </div>
              </div>

              {/* Shift Filter Tabs */}
              <div className="flex p-1 bg-slate-100 rounded-lg mb-6 w-fit">
                <button
                  onClick={() => setShiftFilter('morning')}
                  className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${shiftFilter === 'morning' ? 'bg-white text-cu-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Morning Shifts
                </button>
                <button
                  onClick={() => setShiftFilter('evening')}
                  className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${shiftFilter === 'evening' ? 'bg-white text-cu-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Evening Shifts
                </button>
              </div>

              <div className="space-y-8">
                {shifts
                  .filter(shift => {
                    if (shiftFilter === 'morning') return shift.start_time.includes('AM');
                    if (shiftFilter === 'evening') return shift.start_time.includes('PM');
                    return true;
                  })
                  .map(shift => (
                    <section key={shift.id}>
                      <div className="flex items-center justify-between mb-3 border-b border-cu-maroon/10 pb-2">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-cu-maroon">schedule</span>
                          <div>
                            <h2 className="font-bold text-cu-navy text-sm uppercase">{shift.label}</h2>
                            <p className="text-xs text-slate-500 font-mono">{shift.start_time} - {shift.end_time}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{shift.bookings.length} Students</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-y border-slate-200 text-slate-500">
                              <th className="py-2 px-3 font-semibold">Name</th>
                              <th className="py-2 px-3 font-semibold text-center">UID</th>
                              <th className="py-2 px-3 font-semibold text-right">Phone</th>
                              <th className="py-2 px-3 font-semibold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {shift.bookings.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-4 text-center text-slate-400 italic">No bookings for this date</td>
                              </tr>
                            ) : (
                              shift.bookings.map((booking, idx) => (
                                <tr key={idx} className={booking.status === 'attended' ? 'bg-green-50/50' : booking.status === 'absent' ? 'bg-red-50/50' : booking.status === 'cancelled' ? 'bg-slate-100 opacity-60' : booking.status === 'waitlisted' ? 'bg-orange-50/50' : ''}>
                                  <td className="py-3 px-3 font-medium">
                                    {booking.full_name}
                                    {booking.status === 'waitlisted' && <span className="ml-2 text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded uppercase font-bold">Waitlisted</span>}
                                    {booking.status === 'attended' && <span className="ml-2 text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded uppercase font-bold">Present</span>}
                                    {booking.status === 'absent' && <span className="ml-2 text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded uppercase font-bold">Absent</span>}
                                    {booking.status === 'cancelled' && <span className="ml-2 text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold">Cancelled</span>}
                                  </td>
                                  <td className="py-3 px-3 text-center text-slate-500 font-mono">{booking.uid}</td>
                                  <td className="py-3 px-3 text-right text-slate-500">{booking.phone}</td>
                                  <td className="py-3 px-3 text-right flex justify-end gap-2">
                                    {(booking.status === 'booked' || booking.status === 'waitlisted') && (
                                      <>
                                        {booking.status === 'booked' && (
                                          <>
                                            <button
                                              onClick={() => updateBookingStatus(booking.booking_id, 'attended')}
                                              className="bg-green-600 text-white px-3 py-1 rounded text-[10px] font-bold uppercase hover:bg-green-700"
                                              title="Mark Present"
                                            >
                                              Present
                                            </button>
                                            <button
                                              onClick={() => updateBookingStatus(booking.booking_id, 'absent')}
                                              className="bg-yellow-500 text-white px-3 py-1 rounded text-[10px] font-bold uppercase hover:bg-yellow-600"
                                              title="Mark Absent"
                                            >
                                              Absent
                                            </button>
                                          </>
                                        )}
                                        <button
                                          onClick={() => openCancelModal(booking.booking_id)}
                                          className="bg-red-600 text-white px-3 py-1 rounded text-[10px] font-bold uppercase hover:bg-red-700"
                                          title="Cancel Booking"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    )}
                                    {booking.status !== 'booked' && booking.status !== 'waitlisted' && (
                                      <div className="flex items-center gap-2">
                                        {booking.status === 'cancelled' && booking.cancellation_reason && (
                                          <span className="text-[9px] text-slate-400 italic max-w-[100px] truncate" title={booking.cancellation_reason}>
                                            {booking.cancellation_reason}
                                          </span>
                                        )}
                                        <button
                                          onClick={() => updateBookingStatus(booking.booking_id, 'booked')}
                                          className="text-[10px] text-slate-400 underline hover:text-cu-navy"
                                        >
                                          Reset
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
              </div>
            </>
          )}

          {activeTab === 'slots' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-cu-navy">Manage Slots</h2>
                <button
                  onClick={openCreateSlot}
                  className="bg-cu-maroon text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-cu-navy transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  Add New Slot
                </button>
              </div>

              <div className="grid gap-4">
                {slots.map(slot => (
                  <div key={slot.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-cu-navy text-lg">{slot.label}</h3>
                        <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-mono font-bold">
                          ID: {slot.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-base">schedule</span>
                          {slot.start_time} - {slot.end_time}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-base">group</span>
                          Capacity: <span className="font-bold text-cu-navy">{slot.capacity}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditSlot(slot)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Slot"
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Slot"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <div className="flex gap-2 mb-6 items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setUserFilter('pending')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider ${userFilter === 'pending' ? 'bg-cu-maroon text-white' : 'bg-slate-100 text-slate-500'}`}
                  >
                    Pending Verification
                  </button>
                  <button
                    onClick={() => setUserFilter('all')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider ${userFilter === 'all' ? 'bg-cu-maroon text-white' : 'bg-slate-100 text-slate-500'}`}
                  >
                    All Students
                  </button>
                </div>
                <button
                  onClick={fetchUsers}
                  className="text-cu-navy hover:text-cu-maroon p-2"
                  title="Refresh List"
                >
                  <span className="material-symbols-outlined">refresh</span>
                </button>
              </div>

              {/* Debug Info */}
              <div className="mb-4 text-[10px] text-slate-400">
                Found {users.length} users. Filter: {userFilter}.
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-500">
                      <th className="py-2 px-3 font-semibold">Name</th>
                      <th className="py-2 px-3 font-semibold">UID</th>
                      <th className="py-2 px-3 font-semibold">Phone</th>
                      <th className="py-2 px-3 font-semibold">Hostel & Wing</th>
                      <th className="py-2 px-3 font-semibold">Registered</th>
                      <th className="py-2 px-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map(u => (
                      <tr key={u.id} className={u.is_blocked ? 'bg-red-50' : ''}>
                        <td className="py-3 px-3 font-medium">
                          {u.full_name}
                          {u.is_blocked === 1 && <span className="ml-2 text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded uppercase font-bold">Blocked</span>}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono">{u.uid}</td>
                        <td className="py-3 px-3 text-slate-500">{u.phone}</td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1">
                            {u.hostel_name ? (
                              <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs w-max">
                                <span className="material-symbols-outlined text-[14px]">apartment</span>
                                {u.hostel_name}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Unassigned</span>
                            )}
                            {u.wing_name && (
                              <span className="inline-flex items-center text-slate-600 text-[11px] pl-1">
                                Wing: {u.wing_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[10px]">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="py-3 px-3 text-right flex justify-end gap-2">
                          {u.is_verified === 0 && u.is_blocked === 0 ? (
                            <button
                              onClick={() => verifyUser(u.id)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-[10px] font-bold uppercase hover:bg-green-700"
                            >
                              Verify
                            </button>
                          ) : u.is_verified === 1 ? (
                            <span className="text-green-600 font-bold text-[10px] uppercase py-1">Verified</span>
                          ) : null}

                          {u.is_blocked === 1 ? (
                            <button
                              onClick={() => toggleBlockUser(u.id, false)}
                              className="bg-slate-600 text-white px-3 py-1 rounded text-[10px] font-bold uppercase hover:bg-slate-700"
                            >
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => openBlockModal(u.id)}
                              className="bg-red-100 text-red-700 px-3 py-1 rounded text-[10px] font-bold uppercase hover:bg-red-200"
                            >
                              Block
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">No users found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && analytics && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-cu-navy uppercase border-l-4 border-cu-maroon pl-3 mb-6">
                3-Month Activity Overview
              </h2>

              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Attended</div>
                  <div className="text-2xl font-bold text-green-600 mt-1">{analytics.stats.attended || 0}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Absent</div>
                  <div className="text-2xl font-bold text-red-600 mt-1">{analytics.stats.absent || 0}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Cancelled</div>
                  <div className="text-2xl font-bold text-orange-600 mt-1">{analytics.stats.cancelled || 0}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Bookings</div>
                  <div className="text-2xl font-bold text-cu-navy mt-1">{analytics.stats.total || 0}</div>
                </div>
              </div>


            </div>
          )}

          {activeTab === 'profile' && wardenProfile && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-cu-navy">My Profile</h2>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="bg-cu-navy/5 px-6 py-4 border-b border-slate-200">
                  <h3 className="font-bold text-cu-navy flex items-center gap-2">
                    <span className="material-symbols-outlined">badge</span>
                    Trainer Details
                  </h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Full Name</label>
                    <div className="font-medium text-slate-900 text-lg">{wardenProfile.full_name}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">UID / Staff ID</label>
                    <div className="font-mono text-cu-maroon font-bold bg-cu-maroon/10 w-fit px-2 py-1 rounded">{wardenProfile.uid}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Phone Number</label>
                    <div className="font-medium text-slate-700">{wardenProfile.phone}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Account Created</label>
                    <div className="font-medium text-slate-600 text-sm">{new Date(wardenProfile.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hostels Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-cu-navy/5 px-6 py-4 border-b border-slate-200">
                    <h3 className="font-bold text-cu-navy flex items-center gap-2">
                      <span className="material-symbols-outlined">apartment</span>
                      Assigned Hostels
                    </h3>
                  </div>
                  <div className="p-6">
                    {wardenProfile.hostels && wardenProfile.hostels.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {wardenProfile.hostels.map((hostel: any) => (
                          <div key={hostel.id} className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400 text-sm">domain</span>
                            <span className="font-bold text-slate-700">{hostel.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic text-sm py-4 text-center">No hostels assigned yet.</div>
                    )}
                  </div>
                </div>

                {/* Wings Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-cu-navy/5 px-6 py-4 border-b border-slate-200">
                    <h3 className="font-bold text-cu-navy flex items-center gap-2">
                      <span className="material-symbols-outlined">meeting_room</span>
                      Assigned Wings
                    </h3>
                  </div>
                  <div className="p-6">
                    {wardenProfile.wings && wardenProfile.wings.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {wardenProfile.wings.map((wing: any) => (
                          <div key={wing.id} className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg flex justify-between items-center transition-all hover:border-slate-300 shadow-sm">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800">{wing.name}</span>
                              <span className="text-xs text-slate-500 font-medium">In: <span className="text-cu-maroon">{wing.hostel_name}</span></span>
                            </div>
                            <span className="material-symbols-outlined text-cu-navy/20">chevron_right</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic text-sm py-4 text-center">No wings assigned yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
      {/* Slot Management Modal */}
      {isSlotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-cu-navy mb-4">
              {editingSlot ? 'Edit Slot' : 'Create New Slot'}
            </h3>
            <form onSubmit={handleSlotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Shift Type</label>
                <select
                  value={slotForm.type}
                  onChange={e => setSlotForm({ ...slotForm, type: e.target.value as 'morning' | 'evening' })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-cu-maroon"
                  required
                >
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Label</label>
                <input
                  type="text"
                  value={slotForm.label}
                  onChange={e => setSlotForm({ ...slotForm, label: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-cu-maroon"
                  placeholder="e.g. Morning 1, Evening 2"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Time</label>
                  <input
                    type="text"
                    value={slotForm.start_time}
                    onChange={e => setSlotForm({ ...slotForm, start_time: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-cu-maroon"
                    placeholder="e.g. 06:00 AM"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Time</label>
                  <input
                    type="text"
                    value={slotForm.end_time}
                    onChange={e => setSlotForm({ ...slotForm, end_time: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-cu-maroon"
                    placeholder="e.g. 07:00 AM"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Capacity</label>
                <input
                  type="number"
                  value={slotForm.capacity || ''}
                  onChange={e => setSlotForm({ ...slotForm, capacity: e.target.value ? parseInt(e.target.value) : 0 })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-cu-maroon"
                  min="1"
                  required
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsSlotModalOpen(false)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-cu-maroon text-white py-3 rounded-xl font-bold hover:bg-cu-navy"
                >
                  {editingSlot ? 'Update Slot' : 'Create Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-cu-maroon p-4 flex justify-between items-center">
              <h3 className="text-white font-bold uppercase tracking-wider text-sm">Cancel Booking</h3>
              <button onClick={closeCancelModal} className="text-white/80 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCancelSubmit} className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Are you sure you want to cancel this booking? This action cannot be undone easily.
              </p>
              <div className="mb-4">
                <label className="block text-xs font-bold text-cu-navy uppercase mb-1">Reason for Cancellation</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-lg p-2 text-sm focus:border-cu-maroon focus:ring-0"
                  rows={3}
                  placeholder="e.g. Student misconduct, Maintenance..."
                  required
                ></textarea>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeCancelModal}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-lg uppercase text-xs hover:bg-slate-200"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-cu-maroon text-white font-bold rounded-lg uppercase text-xs hover:bg-red-900"
                >
                  Confirm Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Block User Modal */}
      {blockModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-red-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-bold uppercase tracking-wider text-sm">Block Student</h3>
              <button onClick={closeBlockModal} className="text-white/80 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleBlockSubmit} className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Blocking this student will prevent them from logging in and booking slots.
              </p>
              <div className="mb-4">
                <label className="block text-xs font-bold text-cu-navy uppercase mb-1">Reason for Blocking</label>
                <textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-lg p-2 text-sm focus:border-red-600 focus:ring-0"
                  rows={3}
                  placeholder="e.g. Disciplinary action, ID expired..."
                  required
                ></textarea>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeBlockModal}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-lg uppercase text-xs hover:bg-slate-200"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg uppercase text-xs hover:bg-red-700"
                >
                  Confirm Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
