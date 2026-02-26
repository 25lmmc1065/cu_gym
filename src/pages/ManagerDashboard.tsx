import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface Warden {
  id: number;
  full_name: string;
  uid: string;
  phone: string;
  created_at: string;
  hostel_ids?: number[];
  wing_ids?: number[];
}

interface Student {
  id: number;
  full_name: string;
  uid: string;
  phone: string;
  is_verified: number;
  is_blocked: number;
  created_at: string;
  hostel_id?: number;
  wing_id?: number;
  hostel_name?: string;
  wing_name?: string;
}

interface Hostel {
  id: number;
  name: string;
}

interface Wing {
  id: number;
  name: string;
  hostel_id?: number;
}

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'wardens' | 'students' | 'hostels'>('wardens');
  const [wardens, setWardens] = useState<Warden[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [wings, setWings] = useState<Wing[]>([]);

  const [studentFilterHostel, setStudentFilterHostel] = useState<string>('');
  const [studentFilterWing, setStudentFilterWing] = useState<string>('');
  const [filterWings, setFilterWings] = useState<Wing[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditWardenModalOpen, setIsEditWardenModalOpen] = useState(false);
  const [isHostelModalOpen, setIsHostelModalOpen] = useState(false);
  const [isWingModalOpen, setIsWingModalOpen] = useState(false);
  const [isEditHostelModalOpen, setIsEditHostelModalOpen] = useState(false);
  const [editingHostelForm, setEditingHostelForm] = useState<{ id: number, name: string } | null>(null);

  const [allWings, setAllWings] = useState<Wing[]>([]);
  const [isEditWingModalOpen, setIsEditWingModalOpen] = useState(false);
  const [editingWingForm, setEditingWingForm] = useState<{ id: number, name: string, hostel_id: number } | null>(null);

  const [editingWardenId, setEditingWardenId] = useState<number | null>(null);
  const [editingWardenForm, setEditingWardenForm] = useState({
    full_name: '',
    uid: '',
    phone: '',
    hostel_ids: [] as string[],
    wing_ids: [] as string[]
  });

  const [newHostelName, setNewHostelName] = useState('');
  const [newWingForm, setNewWingForm] = useState({ hostel_id: '', name: '' });

  const [wardenForm, setWardenForm] = useState({
    full_name: '',
    uid: '',
    phone: '',
    password: '',
    hostel_ids: [] as string[],
    wing_ids: [] as string[]
  });

  useEffect(() => {
    if (activeTab === 'wardens') {
      fetchWardens();
      fetchHostels();
    } else if (activeTab === 'students') {
      fetchStudents();
    } else if (activeTab === 'hostels') {
      fetchHostels();
      fetchAllWings();
    }
  }, [activeTab]);

  const fetchWingsForHostels = async (hostelIds: string[]) => {
    if (hostelIds.length === 0) {
      setWings([]);
      return;
    }
    try {
      const wingPromises = hostelIds.map(hId => fetch(`/api/hostels/${hId}/wings`).then(r => r.json()));
      const allWingsArrays = await Promise.all(wingPromises);
      setWings(allWingsArrays.flat());
    } catch (err) {
      console.error("Failed to fetch wings");
    }
  };

  useEffect(() => {
    const activeHostelIds = isEditWardenModalOpen ? editingWardenForm.hostel_ids : wardenForm.hostel_ids;
    fetchWingsForHostels(activeHostelIds);
  }, [wardenForm.hostel_ids, editingWardenForm.hostel_ids, isEditWardenModalOpen]);

  useEffect(() => {
    if (studentFilterHostel) {
      // Fetch wings for the filter dropdown
      fetch(`/api/hostels/${studentFilterHostel}/wings`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          setFilterWings(data);
          // Auto-clear wing filter if the selected wing doesn't belong to the newly selected hostel
          if (studentFilterWing && !data.find((w: Wing) => w.id.toString() === studentFilterWing)) {
            setStudentFilterWing('');
          }
        });
    } else {
      setFilterWings([]);
      setStudentFilterWing('');
    }
  }, [studentFilterHostel]);

  const fetchHostels = async () => {
    try {
      const res = await fetch('/api/hostels');
      if (res.ok) setHostels(await res.json());
    } catch (err) {
      console.error("Failed to fetch hostels");
    }
  };


  const fetchAllWings = async () => {
    try {
      const res = await fetch('/api/manager/wings');
      if (res.ok) setAllWings(await res.json());
    } catch (err) {
      console.error("Failed to fetch all wings");
    }
  };

  const fetchWardens = async () => {
    try {
      const res = await fetch('/api/manager/wardens');
      if (res.ok) {
        setWardens(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch wardens", err);
      toast.error("Failed to load wardens");
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/manager/students');
      if (res.ok) {
        setStudents(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch students", err);
      toast.error("Failed to load students");
    }
  };

  const handleCreateWarden = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/manager/wardens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wardenForm),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Warden created successfully");
        setIsModalOpen(false);
        setWardenForm({ full_name: '', uid: '', phone: '', password: '', hostel_ids: [], wing_ids: [] });
        fetchWardens();
      } else {
        toast.error(data.error || "Failed to create warden");
      }
    } catch (err) {
      console.error("Failed to create warden", err);
      toast.error("An error occurred");
    }
  };

  const handleCheckboxToggle = (
    formType: 'add' | 'edit',
    field: 'hostel_ids' | 'wing_ids',
    value: string
  ) => {
    if (formType === 'add') {
      const current = wardenForm[field];
      const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      setWardenForm({ ...wardenForm, [field]: updated });
    } else {
      const current = editingWardenForm[field];
      const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      setEditingWardenForm({ ...editingWardenForm, [field]: updated });
    }
  };

  const handleEditWardenClick = (warden: Warden) => {
    setEditingWardenId(warden.id);
    setEditingWardenForm({
      full_name: warden.full_name,
      uid: warden.uid,
      phone: warden.phone,
      hostel_ids: warden.hostel_ids?.map(String) || [],
      wing_ids: warden.wing_ids?.map(String) || []
    });
    setIsEditWardenModalOpen(true);
  };

  const handleUpdateWarden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWardenId) return;

    try {
      const res = await fetch(`/api/manager/wardens/${editingWardenId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingWardenForm),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Warden updated successfully");
        setIsEditWardenModalOpen(false);
        setEditingWardenId(null);
        fetchWardens();
      } else {
        toast.error(data.error || "Failed to update warden");
      }
    } catch (err) {
      console.error("Failed to update warden", err);
      toast.error("An error occurred");
    }
  };

  const handleCreateHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/manager/hostels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHostelName }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Hostel created successfully");
        setIsHostelModalOpen(false);
        setNewHostelName('');
        fetchHostels();
      } else {
        toast.error(data.error || "Failed to create hostel");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const handleDeleteHostel = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this hostel? All associated wings and warden mappings will also be removed.")) return;
    try {
      const res = await fetch(`/api/manager/hostels/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success("Hostel deleted successfully");
        fetchHostels();
        fetchAllWings();
        fetchWardens();
      } else {
        toast.error(data.error || "Failed to delete hostel");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const handleCreateWing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/manager/wings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWingForm),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Wing created successfully");
        setIsWingModalOpen(false);
        setNewWingForm({ hostel_id: '', name: '' });
        fetchAllWings();
      } else {
        toast.error(data.error || "Failed to create wing");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const handleEditHostelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHostelForm) return;
    try {
      const res = await fetch(`/api/manager/hostels/${editingHostelForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingHostelForm.name }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Hostel updated successfully");
        setIsEditHostelModalOpen(false);
        setEditingHostelForm(null);
        fetchHostels();
      } else {
        toast.error(data.error || "Failed to update hostel");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const handleEditWingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWingForm) return;
    try {
      const res = await fetch(`/api/manager/wings/${editingWingForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingWingForm.name,
          hostel_id: editingWingForm.hostel_id
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Wing updated successfully");
        setIsEditWingModalOpen(false);
        setEditingWingForm(null);
        fetchAllWings();
        fetchWardens();
      } else {
        toast.error(data.error || "Failed to update wing");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const handleDeleteWing = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this wing? All associated warden mappings will also be removed.")) return;
    try {
      const res = await fetch(`/api/manager/wings/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success("Wing deleted successfully");
        fetchAllWings();
        fetchWardens();
      } else {
        toast.error(data.error || "Failed to delete wing");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const filteredStudents = students.filter(student => {
    let matchesHostel = true;
    let matchesWing = true;

    if (studentFilterHostel) {
      matchesHostel = student.hostel_id?.toString() === studentFilterHostel;
    }

    if (studentFilterWing) {
      matchesWing = student.wing_id?.toString() === studentFilterWing;
    }

    return matchesHostel && matchesWing;
  });

  return (
    <div className="font-display text-slate-900 bg-white flex flex-col min-h-screen">
      {/* Top Bar */}
      <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">shield_person</span>
          Manager Portal
        </div>
        <div className="flex items-center gap-2">
          <span>Manager: {user?.name}</span>
          <button onClick={logout} className="text-cu-maroon hover:underline">Logout</button>
        </div>
      </div>

      {/* Header */}
      <header className="bg-slate-800 sticky top-0 z-30 px-4 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-800">admin_panel_settings</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-sm tracking-tight">Hostel Manager Panel</h1>
            <p className="text-white/70 text-[10px]">Staff & Student Oversight</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="bg-slate-700 w-14 flex flex-col items-center py-6 gap-6 shrink-0">
          <button
            onClick={() => setActiveTab('wardens')}
            className={`material-symbols-outlined text-xl ${activeTab === 'wardens' ? 'text-white' : 'text-white/50'}`}
            title="Manage Trainers"
          >
            badge
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`material-symbols-outlined text-xl ${activeTab === 'students' ? 'text-white' : 'text-white/50'}`}
            title="View Students"
          >
            school
          </button>
          <button
            onClick={() => setActiveTab('hostels')}
            className={`material-symbols-outlined text-xl ${activeTab === 'hostels' ? 'text-white' : 'text-white/50'}`}
            title="Manage Hostels & Wings"
          >
            apartment
          </button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24 bg-white">

          {activeTab === 'wardens' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">Gym Trainers</h2>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-slate-900 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  Add Trainer
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {wardens.map(warden => (
                  <div key={warden.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                        <span className="material-symbols-outlined">person</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-mono">
                          {warden.uid}
                        </span>
                        <button
                          onClick={() => handleEditWardenClick(warden)}
                          className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors"
                          title="Edit Trainer"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Edit</span>
                        </button>
                      </div>
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg mb-1">{warden.full_name}</h3>
                    <div className="space-y-1 text-sm text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-xs">call</span>
                        {warden.phone}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-xs">calendar_today</span>
                        Joined: {new Date(warden.created_at).toLocaleDateString()}
                      </div>
                      {(warden.hostel_ids?.length || 0) > 0 && (
                        <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px] text-slate-400">apartment</span>
                            <span className="text-xs font-bold text-slate-600">Allotted Hostels & Wings:</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {warden.hostel_ids?.map(hId => {
                              const hostelName = hostels.find(h => h.id === hId)?.name || `ID: ${hId}`;
                              return (
                                <span key={hId} className="px-2 py-1 bg-slate-100/80 border border-slate-200 text-[10px] rounded text-slate-700 font-medium">
                                  {hostelName}
                                </span>
                              )
                            })}
                          </div>
                          {(warden.wing_ids?.length || 0) > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {warden.wing_ids?.map(wId => {
                                return (
                                  <span key={wId} className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-[10px] rounded text-slate-500">
                                    Wing ID: {wId}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {wardens.length === 0 && (
                  <div className="col-span-full text-center py-10 text-slate-400 italic">
                    No wardens found. Create one to get started.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">Student Directory</h2>

                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={studentFilterHostel}
                    onChange={e => setStudentFilterHostel(e.target.value)}
                    className="p-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
                  >
                    <option value="">All Hostels</option>
                    {hostels.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>

                  <select
                    value={studentFilterWing}
                    onChange={e => setStudentFilterWing(e.target.value)}
                    className="p-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
                    disabled={!studentFilterHostel}
                  >
                    <option value="">All Wings</option>
                    {filterWings.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white text-xs uppercase text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Student</th>
                      <th className="px-6 py-4">UID</th>
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4">Hostel & Wing</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">
                          {student.full_name}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs font-mono">
                          {student.uid}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{student.phone}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {student.hostel_name ? (
                              <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs w-max">
                                <span className="material-symbols-outlined text-[14px]">apartment</span>
                                {student.hostel_name}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Unassigned</span>
                            )}
                            {student.wing_name && (
                              <span className="inline-flex items-center text-slate-600 text-[11px] pl-1">
                                Wing: {student.wing_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {student.is_verified ? (
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                Verified
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-700 px-2 py-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded">
                                <span className="material-symbols-outlined text-[14px]">pending</span>
                                Pending
                              </span>
                            )}
                            {student.is_blocked ? (
                              <span className="bg-rose-100 text-rose-700 px-2 py-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded">
                                <span className="material-symbols-outlined text-[14px]">block</span>
                                Blocked
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          {students.length === 0 ? "No students found" : "No students match the selected filters"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'hostels' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">Hostels & Wings</h2>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsHostelModalOpen(true)}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-slate-900 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                    Add Hostel
                  </button>
                  <button
                    onClick={() => {
                      if (hostels.length === 0) {
                        toast.error("Please create a hostel first");
                        return;
                      }
                      setIsWingModalOpen(true);
                    }}
                    className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                    Add Wing
                  </button>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {hostels.map(hostel => (
                  <div key={hostel.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-slate-500">apartment</span>
                        <h3 className="font-bold text-slate-800 text-lg">{hostel.name}</h3>
                        <button
                          onClick={() => {
                            setEditingHostelForm({ id: hostel.id, name: hostel.name });
                            setIsEditHostelModalOpen(true);
                          }}
                          className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors ml-2"
                          title="Edit Hostel"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteHostel(hostel.id)}
                          className="flex items-center gap-1 text-red-300 hover:text-red-500 transition-colors ml-1"
                          title="Delete Hostel"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                      <span className="text-xs font-mono bg-white border border-slate-200 text-slate-500 px-2 py-1 rounded">ID: {hostel.id}</span>
                    </div>
                    <div className="p-5 text-sm">
                      <div className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-3">Wings</div>
                      {allWings.filter(w => Number(w.hostel_id) === Number(hostel.id)).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {allWings.filter(w => Number(w.hostel_id) === Number(hostel.id)).map(wing => (
                            <div key={wing.id} className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all hover:border-slate-300">
                              <span className="font-medium text-slate-700">{wing.name}</span>
                              <div className="w-px h-4 bg-slate-200 mx-1"></div>
                              <button
                                onClick={() => {
                                  setEditingWingForm({ id: wing.id, name: wing.name, hostel_id: wing.hostel_id });
                                  setIsEditWingModalOpen(true);
                                }}
                                className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors"
                                title="Edit Wing"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider">Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteWing(wing.id)}
                                className="flex items-center gap-1 text-red-300 hover:text-red-500 transition-colors"
                                title="Delete Wing"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-slate-400 italic text-xs">No wings added yet.</div>
                      )}
                    </div>
                  </div>
                ))}
                {hostels.length === 0 && (
                  <div className="col-span-full text-center py-10 text-slate-400 italic">
                    No hostels created yet.
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Create Warden Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Add New Trainer</h3>
            <form onSubmit={handleCreateWarden} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={wardenForm.full_name}
                  onChange={e => setWardenForm({ ...wardenForm, full_name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">UID / Staff ID</label>
                <input
                  type="text"
                  value={wardenForm.uid}
                  onChange={e => setWardenForm({ ...wardenForm, uid: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
                  placeholder="e.g. WARDEN001"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={wardenForm.phone}
                  onChange={e => setWardenForm({ ...wardenForm, phone: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
                  placeholder="+91..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Hostels</label>
                  <div className="max-h-32 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2 bg-slate-50">
                    {hostels.map(h => (
                      <label key={h.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1.5 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={wardenForm.hostel_ids.includes(h.id.toString())}
                          onChange={() => handleCheckboxToggle('add', 'hostel_ids', h.id.toString())}
                          className="accent-slate-800 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-medium text-slate-700">{h.name}</span>
                      </label>
                    ))}
                    {hostels.length === 0 && <span className="text-xs text-slate-400">No hostels available</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Wings</label>
                  <div className="max-h-32 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2 bg-slate-50">
                    {wings.map(w => (
                      <label key={w.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1.5 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={wardenForm.wing_ids.includes(w.id.toString())}
                          onChange={() => handleCheckboxToggle('add', 'wing_ids', w.id.toString())}
                          className="accent-slate-800 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-medium text-slate-700">{w.name}</span>
                      </label>
                    ))}
                    {wings.length === 0 && <span className="text-xs text-slate-400 block px-1">Select hostel to see wings</span>}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                <input
                  type="password"
                  value={wardenForm.password}
                  onChange={e => setWardenForm({ ...wardenForm, password: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
                  placeholder="Create password"
                  required
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900"
                >
                  Create Warden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Warden Modal */}
      {isEditWardenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Edit Trainer Details</h3>
            <form onSubmit={handleUpdateWarden} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingWardenForm.full_name}
                  onChange={e => setEditingWardenForm({ ...editingWardenForm, full_name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">UID / Staff ID</label>
                <input
                  type="text"
                  value={editingWardenForm.uid}
                  onChange={e => setEditingWardenForm({ ...editingWardenForm, uid: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editingWardenForm.phone}
                  onChange={e => setEditingWardenForm({ ...editingWardenForm, phone: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Hostels</label>
                  <div className="max-h-32 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2 bg-slate-50">
                    {hostels.map(h => (
                      <label key={h.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1.5 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={editingWardenForm.hostel_ids.includes(h.id.toString())}
                          onChange={() => handleCheckboxToggle('edit', 'hostel_ids', h.id.toString())}
                          className="accent-slate-800 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-medium text-slate-700">{h.name}</span>
                      </label>
                    ))}
                    {hostels.length === 0 && <span className="text-xs text-slate-400">No hostels available</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Wings</label>
                  <div className="max-h-32 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2 bg-slate-50">
                    {wings.map(w => (
                      <label key={w.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1.5 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={editingWardenForm.wing_ids.includes(w.id.toString())}
                          onChange={() => handleCheckboxToggle('edit', 'wing_ids', w.id.toString())}
                          className="accent-slate-800 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-medium text-slate-700">{w.name}</span>
                      </label>
                    ))}
                    {wings.length === 0 && <span className="text-xs text-slate-400 block px-1">Select hostel to see wings</span>}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditWardenModalOpen(false)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Hostel Modal */}
      {isHostelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Add New Hostel</h3>
            <form onSubmit={handleCreateHostel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hostel Name</label>
                <input
                  type="text"
                  value={newHostelName}
                  onChange={e => setNewHostelName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
                  placeholder="e.g. Zakir Hussain Hall"
                  required
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsHostelModalOpen(false)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900"
                >
                  Create Hostel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Wing Modal */}
      {isWingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Add New Wing</h3>
            <form onSubmit={handleCreateWing} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Hostel</label>
                <select
                  value={newWingForm.hostel_id}
                  onChange={e => setNewWingForm({ ...newWingForm, hostel_id: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
                  required
                >
                  <option value="">Select Hostel</option>
                  {hostels.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Wing Name</label>
                <input
                  type="text"
                  value={newWingForm.name}
                  onChange={e => setNewWingForm({ ...newWingForm, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
                  placeholder="e.g. A Block, North Wing"
                  required
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsWingModalOpen(false)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900"
                >
                  Create Wing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isEditHostelModalOpen && editingHostelForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
            <button onClick={() => setIsEditHostelModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-600">edit</span>
              </div>
              <h3 className="text-xl font-bold text-slate-800">Edit Hostel</h3>
            </div>
            <form onSubmit={handleEditHostelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hostel Name</label>
                <input
                  type="text"
                  value={editingHostelForm.name}
                  onChange={e => setEditingHostelForm({ ...editingHostelForm, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {isEditWingModalOpen && editingWingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
            <button onClick={() => setIsEditWingModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-600">edit</span>
              </div>
              <h3 className="text-xl font-bold text-slate-800">Edit Wing</h3>
            </div>
            <form onSubmit={handleEditWingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Hostel</label>
                <select
                  value={editingWingForm.hostel_id}
                  onChange={e => setEditingWingForm({ ...editingWingForm, hostel_id: Number(e.target.value) })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
                  required
                >
                  {hostels.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Wing Name</label>
                <input
                  type="text"
                  value={editingWingForm.name}
                  onChange={e => setEditingWingForm({ ...editingWingForm, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
