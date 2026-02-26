import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';


interface Slot {
  id: number;
  start_time: string;
  end_time: string;
  capacity: number;
  label: string;
  type: 'morning' | 'evening';
  booked_count: number;
  available_spots: number;
}

interface Booking {
  id: number;
  booking_date: string;
  status: string;
  start_time: string;
  end_time: string;
  label: string;
  cancellation_reason?: string;
}

export default function StudentDashboard() {
  const { logout } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<'morning' | 'evening'>('morning');
  const [currentView, setCurrentView] = useState<'home' | 'slots' | 'profile' | 'rules'>('home');
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [existingBookingDetails, setExistingBookingDetails] = useState<any>(null);

  const [cancelledBooking, setCancelledBooking] = useState<any>(null);
  const [studentProfile, setStudentProfile] = useState<any>(null);

  useEffect(() => {
    fetchSlots();
    fetchMyBookings();
    fetchProfile();
  }, []);

  const fetchSlots = async () => {
    try {
      const res = await fetch('/api/slots');
      if (res.ok) {
        const data = await res.json();
        setSlots(data);
      }
    } catch (err) {
      console.error("Failed to fetch slots");
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const res = await fetch('/api/bookings/my');
      if (res.ok) {
        const data = await res.json();
        setMyBookings(data);

        // Check for recent cancellations (for today or future)
        const today = new Date().toISOString().split('T')[0];
        const recentCancellation = data.find((b: any) =>
          b.status === 'cancelled' &&
          b.booking_date >= today &&
          !sessionStorage.getItem(`seen_cancel_${b.id}`) // Only show once per session
        );

        if (recentCancellation) {
          setCancelledBooking(recentCancellation);
          sessionStorage.setItem(`seen_cancel_${recentCancellation.id}`, 'true');
        }
      }
    } catch (err) {
      console.error("Failed to fetch bookings");
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/student/profile');
      if (res.ok) {
        setStudentProfile(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch profile");
    }
  };

  const handleBooking = async (slotId: number) => {
    setBookingLoading(slotId);
    setMessage(null);

    // Check if already booked for today locally first
    const today = new Date().toISOString().split('T')[0];
    const alreadyBooked = myBookings.find(b => b.booking_date === today && b.status !== 'cancelled');

    if (alreadyBooked) {
      setExistingBookingDetails(alreadyBooked);
      setShowErrorModal(true);
      setBookingLoading(null);
      return;
    }

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: slotId }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMessage("Booking confirmed successfully!");
        setShowSuccessModal(true);
        fetchSlots();
        fetchMyBookings();
      } else {
        if (data.error === "You have already booked a slot for today.") {
          // Fetch latest bookings to get details if not found locally
          const bookingsRes = await fetch('/api/bookings/my');
          if (bookingsRes.ok) {
            const bookings = await bookingsRes.json();
            const booking = bookings.find((b: any) => b.booking_date === today && b.status !== 'cancelled');
            if (booking) {
              setExistingBookingDetails(booking);
            }
          }
          setShowErrorModal(true);
        } else {
          setMessage({ type: 'error', text: data.error || 'Booking failed' });
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBookingLoading(null);
    }
  };

  const getPriority = (label: string) => {
    if (label.includes('1')) return 'Hostel Wing A';
    if (label.includes('2')) return 'Hostel Wing B';
    if (label.includes('3')) return 'Hostel Wing C';
    return 'General';
  };

  const isBookingOpen = (type: string) => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    if (type === 'morning') {
      return timeInMinutes >= 240 && timeInMinutes <= 480;
    }
    if (type === 'evening') {
      return timeInMinutes >= 990 && timeInMinutes <= 1260;
    }
    return true;
  };

  const getClosedMessage = (type: string) => {
    if (type === 'morning') return 'Opens 4:00 AM - 8:00 AM';
    if (type === 'evening') return 'Opens 4:30 PM - 9:00 PM';
    return 'Booking Closed';
  };

  const morningSlots = slots.filter(s => s.type === 'morning' || (!s.type && s.start_time.includes('AM')));
  const eveningSlots = slots.filter(s => s.type === 'evening' || (!s.type && s.start_time.includes('PM')));

  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  const todayISO = new Date().toISOString().split('T')[0];
  const alreadyBookedToday = myBookings.find(b => b.booking_date === todayISO && b.status !== 'cancelled');

  return (
    <div className="min-h-screen flex flex-col bg-cu-light font-sans text-slate-800">
      {/* Top Notification Bar */}
      <div className="bg-cu-navy text-white text-[11px] py-2 px-4 flex items-center gap-2 overflow-hidden whitespace-nowrap">
        <span className="bg-cu-gold text-cu-navy px-1.5 font-bold rounded text-[9px] uppercase">Update</span>
        <div className="animate-marquee">Gym will be closed for maintenance on Sunday. Please plan accordingly.</div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 cu-gradient-header shadow-lg px-4 py-3 flex items-center justify-between border-b-2 border-cu-gold">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded flex items-center justify-center p-1 shadow-inner">
            <img alt="CU Logo" className="w-full h-full object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9XkeRjfO1diZ1ZxxxBNAkJrHIpeRIjoIwnjIu2hKLcSpv77al_t0si5kCG1DCCLKnnf7JKoMvQ6AqA-M0wf4878Afk9iwroTT-Z-Rr7e_WTMCrGya_XnQ3cJMKZ_xUYcz3oa7RVqeaR8L45EWueAV5YSJ_bdHPqdwQTA3PEiUeRL9r8jIuxFg5TkZhW5PfxqzDn__FCDBzTTWQKE6WI_Rpiiw03IOdTeDc0xifttalcAWCTpl4O2utnK_zdrc05DycfR5ZVNx5MEa" />
          </div>
          <div>
            <h1 className="text-white font-oswald text-lg leading-none uppercase">Hostel Gym Portal</h1>
            <p className="text-cu-gold text-[10px] font-bold tracking-[0.1em] uppercase">Unnao Campus</p>
          </div>
        </div>
        <button className="text-white" onClick={logout}>
          <span className="material-symbols-outlined text-2xl">logout</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-5 pb-24">

        {/* HOME VIEW */}
        {currentView === 'home' && (
          <>
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm -mx-5 -mt-5 mb-6">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cu-navy text-xl">calendar_month</span>
                <span className="text-xs font-bold text-cu-navy uppercase tracking-tight">{todayDate}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 rounded border border-red-100">
                <span className="material-symbols-outlined text-red-600 text-sm">badge</span>
                <span className="text-[9px] font-black text-red-700 uppercase">Student ID Req.</span>
              </div>
            </div>

            <section className="mb-6">
              <h2 className="text-2xl font-oswald font-bold text-cu-navy uppercase border-l-4 border-cu-maroon pl-3">Book Your Slot</h2>
              <p className="text-slate-500 text-sm mt-1">Select from available daily training sessions.</p>
            </section>

            {message && (
              <div className={`mb-4 p-3 rounded text-xs font-bold ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {message.text}
              </div>
            )}

            {/* Segmented Control */}
            <div className="segmented-control flex p-1 bg-slate-200/50 rounded-xl mb-6 relative">
              <button
                onClick={() => setActiveTab('morning')}
                className={`flex-1 text-center py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${activeTab === 'morning' ? 'bg-cu-maroon text-white shadow-md' : 'text-slate-500'}`}
              >
                Morning Shifts
              </button>
              <button
                onClick={() => setActiveTab('evening')}
                className={`flex-1 text-center py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${activeTab === 'evening' ? 'bg-cu-maroon text-white shadow-md' : 'text-slate-500'}`}
              >
                Evening Shifts
              </button>
            </div>

            {/* Slots List */}
            <div className="space-y-5">
              {loading ? (
                <div className="text-center py-10 text-slate-400">Loading slots...</div>
              ) : (
                (activeTab === 'morning' ? morningSlots : eveningSlots).map(slot => {
                  const percentFull = Math.round((slot.booked_count / slot.capacity) * 100);
                  const isFull = slot.available_spots === 0;
                  const slotType = slot.type || (slot.start_time.includes('AM') ? 'morning' : 'evening');
                  const isOpen = isBookingOpen(slotType);

                  return (
                    <div key={slot.id} className={`bg-white border-2 ${isFull ? 'border-slate-200 opacity-80' : 'border-cu-maroon'} rounded-xl overflow-hidden shadow-md flex flex-col`}>
                      <div className={`h-3 w-full ${isFull ? 'bg-slate-400' : 'bg-cu-maroon'}`}></div>
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${isFull ? 'text-slate-500 bg-slate-100 border-slate-200' : 'text-cu-maroon bg-red-50 border-cu-maroon/20'}`}>
                              {slot.label}
                            </span>
                            <h3 className={`text-xl font-oswald mt-1 ${isFull ? 'text-slate-400' : 'text-cu-navy'}`}>
                              {slot.start_time} – {slot.end_time}
                            </h3>
                            <p className="text-xs font-medium text-slate-400 mt-1">
                              Priority: <span className={isFull ? 'text-slate-500' : 'text-cu-navy'}>{getPriority(slot.label)}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-black block uppercase ${isFull ? 'text-red-500' : 'text-green-600'}`}>
                              {isFull ? 'Fully Booked' : 'Available'}
                            </span>
                            <span className="text-[9px] text-slate-400 uppercase">
                              {slot.booked_count}/{slot.capacity} Booked
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-5">
                          <div
                            className={`h-full rounded-full ${isFull ? 'bg-slate-300' : 'bg-cu-gold'}`}
                            style={{ width: `${percentFull}%` }}
                          ></div>
                        </div>

                        <button
                          onClick={() => handleBooking(slot.id)}
                          disabled={!isOpen || !!alreadyBookedToday || bookingLoading === slot.id}
                          className={`w-full font-bold py-3 rounded-lg transition-all duration-300 uppercase tracking-wider text-sm shadow-md flex items-center justify-center gap-2
                            ${!isOpen ? 'bg-slate-200 text-slate-500 cursor-not-allowed' :
                              (!!alreadyBookedToday
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : isFull
                                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                  : 'bg-cu-maroon hover:bg-cu-gold text-white')
                            }`}
                        >
                          {!isOpen
                            ? getClosedMessage(slotType)
                            : !!alreadyBookedToday
                              ? 'Limit Reached'
                              : bookingLoading === slot.id
                                ? 'Processing...'
                                : isFull
                                  ? 'Join Waitlist'
                                  : 'Book Slot'}
                          {(isOpen && !alreadyBookedToday) && <span className="material-symbols-outlined text-sm">
                            {isFull ? 'person_add' : 'arrow_forward'}
                          </span>}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* MY SLOTS VIEW */}
        {currentView === 'slots' && (
          <div className="space-y-6">
            <section>
              <h2 className="text-2xl font-oswald font-bold text-cu-navy uppercase border-l-4 border-cu-maroon pl-3">My Bookings</h2>
              <p className="text-slate-500 text-sm mt-1">History of your gym sessions.</p>
            </section>

            <div className="space-y-4">
              {myBookings.length === 0 ? (
                <div className="bg-white p-8 rounded-xl text-center shadow-sm">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">event_busy</span>
                  <p className="text-slate-500 font-bold">No bookings found</p>
                  <button onClick={() => setCurrentView('home')} className="mt-4 text-cu-maroon text-sm font-bold hover:underline">Book a slot now</button>
                </div>
              ) : (
                myBookings.map(booking => (
                  <div key={booking.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${booking.status === 'cancelled' ? 'border-red-200 opacity-75' : 'border-slate-200'}`}>
                    <div className={`px-4 py-2 flex justify-between items-center ${booking.status === 'cancelled' ? 'bg-red-50' : 'bg-cu-navy'}`}>
                      <span className={`${booking.status === 'cancelled' ? 'text-red-700' : 'text-white'} text-xs font-bold uppercase tracking-wider`}>{booking.booking_date}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${booking.status === 'attended' ? 'bg-green-100 text-green-700' :
                        booking.status === 'absent' ? 'bg-red-100 text-red-700' :
                          booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            booking.status === 'waitlisted' ? 'bg-orange-100 text-orange-700' :
                              'bg-green-500 text-white'
                        }`}>
                        {booking.status}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <div className="text-xs text-slate-500 font-bold uppercase">{booking.label}</div>
                          <div className="text-lg font-oswald text-cu-navy">{booking.start_time} - {booking.end_time}</div>
                        </div>
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${booking.status === 'cancelled' ? 'bg-red-50' : 'bg-slate-100'}`}>
                          <span className={`material-symbols-outlined ${booking.status === 'cancelled' ? 'text-red-500' : 'text-cu-maroon'}`}>
                            {booking.status === 'cancelled' ? 'block' : 'fitness_center'}
                          </span>
                        </div>
                      </div>

                      {booking.status === 'cancelled' && booking.cancellation_reason && (
                        <div className="mt-2 pt-2 border-t border-red-100">
                          <p className="text-[10px] text-red-500 font-bold uppercase mb-0.5">Cancellation Reason:</p>
                          <p className="text-xs text-red-700 italic">"{booking.cancellation_reason}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Cancellation Notification Modal */}
        {cancelledBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center transform transition-all scale-100 border-t-4 border-red-500">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-red-600">cancel</span>
              </div>
              <h3 className="text-xl font-bold text-cu-navy mb-2">Booking Cancelled</h3>
              <p className="text-slate-600 mb-4">
                Your booking for <span className="font-bold">{cancelledBooking.booking_date}</span> has been cancelled by the admin.
              </p>

              {cancelledBooking.cancellation_reason && (
                <div className="bg-red-50 p-3 rounded-lg border border-red-100 mb-6">
                  <p className="text-xs text-red-500 font-bold uppercase mb-1">Reason</p>
                  <p className="text-sm text-red-800 italic">"{cancelledBooking.cancellation_reason}"</p>
                </div>
              )}

              <button
                onClick={() => setCancelledBooking(null)}
                className="w-full bg-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* PROFILE VIEW */}
        {currentView === 'profile' && (
          <div className="space-y-6">
            <section>
              <h2 className="text-2xl font-oswald font-bold text-cu-navy uppercase border-l-4 border-cu-maroon pl-3">My Profile</h2>
            </section>

            {studentProfile ? (
              <div className="space-y-6">
                {/* Personal Details Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-cu-navy h-20 relative">
                    <div className="absolute -bottom-8 left-6 w-16 h-16 bg-white rounded-xl shadow-md flex items-center justify-center p-1 border-2 border-cu-maroon">
                      <div className="w-full h-full bg-slate-100 rounded-lg flex items-center justify-center text-cu-maroon">
                        <span className="material-symbols-outlined text-3xl">person</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-10 pb-6 px-6">
                    <h3 className="text-xl font-oswald text-cu-navy tracking-wide">{studentProfile.full_name}</h3>

                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Student ID</p>
                        <p className="font-mono text-sm font-bold text-cu-maroon bg-cu-maroon/10 px-2 py-1 rounded inline-block">{studentProfile.uid}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Phone</p>
                        <p className="font-medium text-slate-700">{studentProfile.phone}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Joined</p>
                        <p className="font-medium text-slate-600 text-sm">{new Date(studentProfile.created_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Status</p>
                        <p className="font-medium text-green-600 text-sm font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">verified</span> Verified
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location & Warden Details Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-cu-maroon">apartment</span>
                    <h3 className="font-bold text-cu-navy uppercase text-sm tracking-wider">Accommodation Details</h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-y-6">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">domain</span> Hostel
                        </p>
                        <p className="font-bold text-slate-800">{studentProfile.hostel_name || 'Not Assigned'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">meeting_room</span> Wing
                        </p>
                        <p className="font-bold text-slate-800">{studentProfile.wing_name || 'Not Assigned'}</p>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">admin_panel_settings</span> Assigned Gym Trainer(s)
                      </p>
                      {studentProfile.warden_names && studentProfile.warden_names.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {studentProfile.warden_names.map((name: string, index: number) => (
                            <div key={index} className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                              <span className="w-6 h-6 rounded-full bg-cu-navy text-white flex items-center justify-center text-[10px] font-bold">
                                {name.charAt(0)}
                              </span>
                              <span className="font-medium text-slate-700 text-sm">{name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 italic">No gym trainer assigned to your hostel/wing.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400">Loading profile...</div>
            )}

            <button onClick={logout} className="w-full bg-slate-200 text-slate-600 font-bold py-3 rounded-lg uppercase tracking-wider text-sm hover:bg-slate-300 transition-colors">
              Logout
            </button>
          </div>
        )}

        {/* RULES VIEW */}
        {currentView === 'rules' && (
          <div className="space-y-6">
            <section>
              <h2 className="text-2xl font-oswald font-bold text-cu-navy uppercase border-l-4 border-cu-maroon pl-3">Gym Rules</h2>
            </section>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-cu-maroon shrink-0">badge</span>
                <p className="text-sm text-slate-600">Student ID card is mandatory for entry. No ID, No Entry.</p>
              </div>
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-cu-maroon shrink-0">checkroom</span>
                <p className="text-sm text-slate-600">Proper sports attire and clean sports shoes are required.</p>
              </div>
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-cu-maroon shrink-0">schedule</span>
                <p className="text-sm text-slate-600">Adhere strictly to your booked time slot. Late entry is not permitted.</p>
              </div>
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-cu-maroon shrink-0">cleaning_services</span>
                <p className="text-sm text-slate-600">Re-rack weights after use and wipe down equipment.</p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center transform transition-all scale-100">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-green-600">check_circle</span>
            </div>
            <h3 className="text-xl font-bold text-cu-navy mb-2">Success!</h3>
            <p className="text-slate-600 mb-6">{successMessage}</p>
            <button
              onClick={() => {
                setShowSuccessModal(false);
                setCurrentView('slots');
              }}
              className="w-full bg-cu-navy text-white py-3 rounded-xl font-bold hover:bg-cu-navy/90"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Error/Info Modal (Already Booked) */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center transform transition-all scale-100">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-blue-600">info</span>
            </div>
            <h3 className="text-xl font-bold text-cu-navy mb-2">Already Booked</h3>
            <p className="text-slate-600 mb-4">You have already booked a slot for today.</p>

            {existingBookingDetails && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 text-left">
                <p className="text-xs text-slate-500 uppercase font-bold mb-2">Booking Details</p>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-slate-600">Slot:</span>
                  <span className="text-sm font-bold text-cu-navy">{existingBookingDetails.label}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-slate-600">Time:</span>
                  <span className="text-sm font-bold text-cu-navy">{existingBookingDetails.start_time} - {existingBookingDetails.end_time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Status:</span>
                  <span className="text-sm font-bold text-blue-600 uppercase">{existingBookingDetails.status}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowErrorModal(false)}
              className="w-full bg-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-300"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-200 px-6 py-2 flex justify-around items-center z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setCurrentView('home')}
          className={`flex flex-col items-center gap-1 group transition-colors ${currentView === 'home' ? 'text-cu-maroon' : 'text-slate-400 hover:text-cu-navy'}`}
        >
          <span className={`material-symbols-outlined ${currentView === 'home' ? 'active-icon' : ''}`}>home</span>
          <span className="text-[10px] font-bold uppercase tracking-tight">Home</span>
        </button>
        <button
          onClick={() => setCurrentView('slots')}
          className={`flex flex-col items-center gap-1 group transition-colors ${currentView === 'slots' ? 'text-cu-maroon' : 'text-slate-400 hover:text-cu-navy'}`}
        >
          <span className={`material-symbols-outlined ${currentView === 'slots' ? 'active-icon' : ''}`}>event_note</span>
          <span className="text-[10px] font-bold uppercase tracking-tight">My Slots</span>
        </button>
        <button
          onClick={() => setCurrentView('profile')}
          className={`flex flex-col items-center gap-1 group transition-colors ${currentView === 'profile' ? 'text-cu-maroon' : 'text-slate-400 hover:text-cu-navy'}`}
        >
          <span className={`material-symbols-outlined ${currentView === 'profile' ? 'active-icon' : ''}`}>account_circle</span>
          <span className="text-[10px] font-bold uppercase tracking-tight">Profile</span>
        </button>
        <button
          onClick={() => setCurrentView('rules')}
          className={`flex flex-col items-center gap-1 group transition-colors ${currentView === 'rules' ? 'text-cu-maroon' : 'text-slate-400 hover:text-cu-navy'}`}
        >
          <span className={`material-symbols-outlined ${currentView === 'rules' ? 'active-icon' : ''}`}>gavel</span>
          <span className="text-[10px] font-bold uppercase tracking-tight">Rules</span>
        </button>
      </nav>
    </div>
  );
}
