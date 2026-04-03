import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Utensils, 
  MapPin, 
  Plus, 
  Search, 
  Bell, 
  User as UserIcon, 
  ChevronRight,
  Info,
  CheckCircle2,
  Clock,
  Building2,
  MessageSquare,
  Settings,
  Link as LinkIcon,
  Send,
  ShieldCheck,
  Navigation,
  LogOut,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Donation, Message, Connection, UserProfile } from './types';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  getDoc, 
  getDocs,
  Timestamp
} from './firebase';
import type { User } from './firebase';

type Tab = 'home' | 'donate' | 'ngos' | 'impact' | 'chat' | 'connections' | 'settings';
type Role = 'restaurant' | 'ngo';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [role, setRole] = useState<Role>('restaurant');
  const [donations, setDonations] = useState<Donation[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    donor: '',
    type: 'Restaurant',
    items: '',
    location: '',
    time: '',
    contact: '',
    temperature: 'Ambient',
    deadline: ''
  });
  const [matchingDonation, setMatchingDonation] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [showRatingModal, setShowRatingModal] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [notifications, setNotifications] = useState({
    newDonations: true,
    chatMessages: true,
    pickupReminders: true
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const profile = userDoc.data() as UserProfile;
          setUserProfile(profile);
          setRole(profile.role as Role);
        } else {
          // New user, default to restaurant
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Anonymous',
            email: currentUser.email || '',
            role: 'restaurant'
          };
          await updateDoc(doc(db, 'users', currentUser.uid), newProfile as any);
          setUserProfile(newProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const qDonations = query(collection(db, 'donations'), orderBy('createdAt', 'desc'));
    const unsubscribeDonations = onSnapshot(qDonations, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Donation));
      setDonations(data);
    });

    const qConnections = query(collection(db, 'connections'), orderBy('timestamp', 'desc'));
    const unsubscribeConnections = onSnapshot(qConnections, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Connection));
      setConnections(data);
    });

    return () => {
      unsubscribeDonations();
      unsubscribeConnections();
    };
  }, [user]);

  useEffect(() => {
    if (!activeConnectionId) return;

    const qMessages = query(
      collection(db, 'messages'), 
      where('connectionId', '==', activeConnectionId),
      orderBy('timestamp', 'asc')
    );
    const unsubscribeMessages = onSnapshot(qMessages, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(data);
    });

    return () => unsubscribeMessages();
  }, [activeConnectionId]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('home');
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeConnectionId) return;
    try {
      await addDoc(collection(db, 'messages'), {
        connectionId: activeConnectionId,
        sender: user.displayName || 'Anonymous',
        senderUid: user.uid,
        text: newMessage,
        timestamp: new Date().toISOString()
      });
      setNewMessage('');
    } catch (err) {
      console.error("Send failed", err);
    }
  };

  const handleMatch = async (donationId: string) => {
    if (!user || !userProfile) return;
    try {
      const donation = donations.find(d => d.id === donationId);
      if (!donation) return;

      // Mock matching logic for now, but using Firestore
      const newConnection = {
        donationId,
        restaurant: donation.donor,
        ngo: userProfile.displayName,
        donationItems: donation.items,
        status: 'Pending',
        timestamp: new Date().toISOString(),
        rated: false,
        donorUid: donation.authorUid,
        ngoUid: user.uid
      };

      const docRef = await addDoc(collection(db, 'connections'), newConnection);
      await updateDoc(doc(db, 'donations', donationId), { status: 'Matched' });
      
      setMatchingDonation({
        ...newConnection,
        id: docRef.id,
        matchedNGO: { name: userProfile.displayName, area: userProfile.location || 'Your Area' },
        distance: "0.8 km",
        estimatedArrival: "15 mins"
      });
    } catch (err) {
      console.error("Matching failed", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'donations'), {
        ...formData,
        authorUid: user.uid,
        status: "Available",
        createdAt: new Date().toISOString(),
        donorRating: userProfile?.rating || 5.0
      });
      setFormData({ 
        donor: '', 
        type: 'Restaurant', 
        items: '', 
        location: '', 
        time: '', 
        contact: '',
        temperature: 'Ambient',
        deadline: ''
      });
      setActiveTab('home');
    } catch (err) {
      console.error("Submission failed", err);
    }
  };

  const handleRate = async (connectionId: string) => {
    try {
      await updateDoc(doc(db, 'connections', connectionId), {
        rated: true,
        status: 'Completed'
      });
      setShowRatingModal(null);
    } catch (err) {
      console.error("Rating failed", err);
    }
  };

  const filteredDonations = donations.filter(d => {
    const matchesSearch = d.items.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         d.donor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'All' || d.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="bg-orange-500 p-2 rounded-xl">
              <Heart className="text-white w-6 h-6" />
            </div>
            <span className="font-bold text-xl tracking-tight">FoodBridge</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            {(['home', 'donate', 'ngos', 'connections', 'chat', 'impact'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`capitalize font-medium transition-colors text-sm ${
                  activeTab === tab ? 'text-orange-500' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex bg-slate-100 p-1 rounded-xl mr-2">
              <button 
                onClick={() => setRole('restaurant')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${role === 'restaurant' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}
              >
                Restaurant
              </button>
              <button 
                onClick={() => setRole('ngo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${role === 'ngo' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}
              >
                NGO
              </button>
            </div>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`p-2 rounded-full transition-colors ${activeTab === 'settings' ? 'bg-orange-100 text-orange-600' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <Settings className="w-5 h-5" />
            </button>
            {user ? (
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full font-medium hover:bg-slate-800 transition-all active:scale-95 text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-full font-medium hover:bg-orange-600 transition-all active:scale-95 text-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </button>
            )}
          </div>

        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!user && activeTab !== 'home' ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="bg-orange-100 p-6 rounded-full text-orange-600">
              <ShieldCheck className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-bold">Please Login to Continue</h2>
            <p className="text-slate-500">You need to be signed in to access this feature.</p>
            <button 
              onClick={handleLogin}
              className="bg-orange-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-orange-600 transition-all"
            >
              Login with Google
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {/* Hero Section */}
              <section className="relative rounded-3xl overflow-hidden bg-slate-900 text-white p-8 md:p-16">
                <div className="relative z-10 max-w-2xl space-y-6">
                  <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                    Connecting Surplus to <span className="text-orange-500">Service.</span>
                  </h1>
                  <p className="text-slate-300 text-lg md:text-xl">
                    Join the network bridging the gap between food waste and hunger. 
                    Restaurants and donors meet local NGOs in real-time.
                  </p>
                  <div className="flex flex-wrap gap-4 pt-4">
                    <button 
                      onClick={() => setActiveTab('donate')}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 shadow-lg shadow-orange-500/20"
                    >
                      Donate Food
                    </button>
                    <button 
                      onClick={() => setActiveTab('ngos')}
                      className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border border-white/20 px-8 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95"
                    >
                      Join as NGO
                    </button>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-l from-slate-900 to-transparent z-10" />
                  <img 
                    src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=1000" 
                    alt="Community" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </section>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: "Meals Shared", value: "12,450+", icon: Utensils, color: "bg-blue-500" },
                  { label: "Active NGOs", value: "85+", icon: Building2, color: "bg-purple-500" },
                  { label: "Donors", value: "230+", icon: Heart, color: "bg-pink-500" }
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className={`${stat.color} p-3 rounded-2xl text-white`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Search & Filter */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input 
                    type="text" 
                    placeholder="Search donations (e.g. Lasagna, Pasta Palace)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  {['All', 'Restaurant', 'Individual'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        filterType === type ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Recent Donations Nearby</h2>
                  <button className="text-orange-500 font-semibold flex items-center gap-1 hover:underline">
                    View All <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {loading ? (
                    [1,2,3].map(i => (
                      <div key={i} className="h-48 bg-slate-200 animate-pulse rounded-3xl" />
                    ))
                  ) : (
                    filteredDonations.map((donation) => (
                      <div key={donation.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                            <div className="bg-orange-50 p-2 rounded-xl text-orange-600">
                              <Utensils className="w-5 h-5" />
                            </div>
                            <div className="flex items-center gap-1 text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">
                              <Heart className="w-3 h-3 fill-current" />
                              <span className="text-xs font-bold">{donation.donorRating || 'New'}</span>
                            </div>
                          </div>
                          <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            {donation.status}
                          </span>
                        </div>
                        <h3 className="font-bold text-lg mb-1">{donation.donor}</h3>
                        <p className="text-slate-600 text-sm mb-2">{donation.items}</p>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                          {donation.temperature && (
                            <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                              {donation.temperature}
                            </span>
                          )}
                          {donation.deadline && (
                            <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              By {new Date(donation.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                          <div className="flex items-center gap-2 text-slate-500 text-xs">
                            <MapPin className="w-3 h-3" />
                            <span>{donation.location}</span>
                          </div>
                          <button 
                            onClick={() => handleMatch(donation.id)}
                            className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-orange-500 transition-colors"
                          >
                            Find Match
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Rating Modal */}
                <AnimatePresence>
                  {showRatingModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-full h-2 bg-orange-500" />
                        <button 
                          onClick={() => setShowRatingModal(null)}
                          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"
                        >
                          <Plus className="w-6 h-6 rotate-45" />
                        </button>

                        <div className="text-center space-y-6">
                          <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-orange-600">
                            <Heart className="w-10 h-10 fill-current" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold">Rate Your Experience</h3>
                            <p className="text-slate-500">Your feedback helps us maintain a reliable community.</p>
                          </div>

                          <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => setRatingValue(star)}
                                className={`p-2 transition-all ${ratingValue >= star ? 'text-orange-500' : 'text-slate-200'}`}
                              >
                                <Heart className={`w-8 h-8 ${ratingValue >= star ? 'fill-current' : ''}`} />
                              </button>
                            ))}
                          </div>

                          <div className="space-y-4">
                            <textarea 
                              placeholder="Add a comment (optional)..."
                              className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none"
                            />
                            <button 
                              onClick={() => handleRate(showRatingModal)}
                              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-500/20 transition-all"
                            >
                              Submit Rating
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                {/* Match Modal */}
                <AnimatePresence>
                  {matchingDonation && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-full h-2 bg-orange-500" />
                        <button 
                          onClick={() => setMatchingDonation(null)}
                          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"
                        >
                          <Plus className="w-6 h-6 rotate-45" />
                        </button>

                        <div className="text-center space-y-6">
                          <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-orange-600">
                            <CheckCircle2 className="w-10 h-10" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold">Perfect Match Found!</h3>
                            <p className="text-slate-500">We've found the nearest NGO ready to accept this donation.</p>
                          </div>

                          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-left space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="bg-white p-3 rounded-2xl shadow-sm">
                                <Building2 className="w-6 h-6 text-orange-500" />
                              </div>
                              <div>
                                <p className="font-bold text-lg">{matchingDonation.matchedNGO.name}</p>
                                <p className="text-sm text-slate-500">{matchingDonation.matchedNGO.area}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-2">
                              <div className="bg-white p-3 rounded-2xl border border-slate-100">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Distance</p>
                                <p className="font-bold text-slate-700">{matchingDonation.distance}</p>
                              </div>
                              <div className="bg-white p-3 rounded-2xl border border-slate-100">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Arrival</p>
                                <p className="font-bold text-slate-700">{matchingDonation.estimatedArrival}</p>
                              </div>
                            </div>
                          </div>

                          <button 
                            onClick={() => setMatchingDonation(null)}
                            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all"
                          >
                            Confirm Connection
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </section>
            </motion.div>
          )}

          {activeTab === 'donate' && (
            <motion.div
              key="donate"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold">Share Your Surplus</h2>
                <p className="text-slate-500">Fill in the details to notify nearby NGOs about your donation.</p>
              </div>

              <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Donor Name</label>
                    <input 
                      type="text" 
                      required
                      value={formData.donor}
                      onChange={(e) => setFormData({...formData, donor: e.target.value})}
                      placeholder="Restaurant or Your Name"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Donor Type</label>
                    <select 
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all bg-white"
                    >
                      <option>Restaurant</option>
                      <option>Individual</option>
                      <option>Corporate</option>
                      <option>Event Organizer</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">What are you donating?</label>
                  <textarea 
                    required
                    value={formData.items}
                    onChange={(e) => setFormData({...formData, items: e.target.value})}
                    placeholder="e.g. 15 boxes of vegetarian meals, fresh bread, etc."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Pickup Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                      type="text" 
                      required
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      placeholder="Enter address"
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Food Temperature</label>
                    <select 
                      value={formData.temperature}
                      onChange={(e) => setFormData({...formData, temperature: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all bg-white"
                    >
                      <option>Ambient</option>
                      <option>Hot</option>
                      <option>Cold</option>
                      <option>Frozen</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Pickup Deadline</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input 
                        type="datetime-local" 
                        required
                        value={formData.deadline}
                        onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Best Pickup Time</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input 
                        type="time" 
                        required
                        value={formData.time}
                        onChange={(e) => setFormData({...formData, time: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Contact Number</label>
                    <input 
                      type="tel" 
                      required
                      value={formData.contact}
                      onChange={(e) => setFormData({...formData, contact: e.target.value})}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
                >
                  Post Donation
                </button>
              </form>
            </motion.div>
          )}

          {activeTab === 'ngos' && (
            <motion.div
              key="ngos"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold">Partner NGOs</h2>
                  <p className="text-slate-500">Discover and connect with local organizations serving the community.</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input 
                    type="text" 
                    placeholder="Search by area or name..."
                    className="pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none w-full md:w-80"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { name: "City Rescue Mission", focus: "Homelessness", area: "Downtown", rating: 4.9 },
                  { name: "Green Earth Kitchen", focus: "Sustainability", area: "East Side", rating: 4.7 },
                  { name: "Youth First Foundation", focus: "Children", area: "West Park", rating: 4.8 },
                  { name: "Senior Care Network", focus: "Elderly", area: "North Hills", rating: 4.6 },
                  { name: "Community Table", focus: "Food Security", area: "South Bay", rating: 4.9 },
                  { name: "Hope Harbor", focus: "Emergency Relief", area: "Riverside", rating: 4.5 }
                ].map((ngo, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-orange-200 transition-colors">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold">{ngo.name}</h3>
                        <p className="text-xs text-orange-600 font-bold uppercase tracking-wider">{ngo.focus}</p>
                      </div>
                    </div>
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <MapPin className="w-4 h-4" />
                        <span>{ngo.area}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>Verified Partner</span>
                      </div>
                    </div>
                    <button className="w-full border border-slate-200 hover:border-orange-500 hover:text-orange-500 py-3 rounded-xl font-semibold transition-all">
                      View Profile
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'impact' && (
            <motion.div
              key="impact"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="text-center max-w-2xl mx-auto space-y-4">
                <h2 className="text-4xl font-bold">Our Collective Impact</h2>
                <p className="text-slate-500 text-lg">Every donation counts. See how our community is making a difference together.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
                  <h3 className="text-xl font-bold">Monthly Meals Distributed</h3>
                  <div className="h-64 flex items-end gap-2">
                    {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div 
                          className="w-full bg-orange-100 rounded-t-lg relative group"
                          style={{ height: `${h}%` }}
                        >
                          <div className="absolute inset-0 bg-orange-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-bottom rounded-t-lg" />
                        </div>
                        <span className="text-xs text-slate-400 font-medium">M{i+1}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-blue-50 p-8 rounded-[2rem] space-y-4">
                    <div className="bg-blue-500 w-12 h-12 rounded-2xl flex items-center justify-center text-white">
                      <Info className="w-6 h-6" />
                    </div>
                    <h3 className="text-3xl font-bold text-blue-900">2.4 Tons</h3>
                    <p className="text-blue-700 font-medium">Food waste diverted from landfills this year.</p>
                  </div>
                  <div className="bg-green-50 p-8 rounded-[2rem] space-y-4">
                    <div className="bg-green-500 w-12 h-12 rounded-2xl flex items-center justify-center text-white">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-3xl font-bold text-green-900">98%</h3>
                    <p className="text-green-700 font-medium">Successful pickup rate across all donations.</p>
                  </div>
                </div>
              </div>

              <section className="bg-orange-500 rounded-[3rem] p-8 md:p-16 text-white text-center space-y-8">
                <h2 className="text-3xl md:text-5xl font-bold">Ready to make an impact?</h2>
                <p className="text-orange-100 text-lg max-w-xl mx-auto">
                  Whether you have a few extra meals or want to volunteer your time, 
                  there's a place for you in our community.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <button onClick={() => setActiveTab('donate')} className="bg-white text-orange-500 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-orange-50 transition-all active:scale-95">
                    Start Donating
                  </button>
                  <button className="bg-orange-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-orange-700 transition-all active:scale-95">
                    Contact Support
                  </button>
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[70vh]">
              {/* Connection List */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-lg">Your Connections</h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {connections.filter(c => c.donorUid === user?.uid || c.ngoUid === user?.uid).map(conn => (
                    <button
                      key={conn.id}
                      onClick={() => setActiveConnectionId(conn.id)}
                      className={`w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-all border-b border-slate-50 ${activeConnectionId === conn.id ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''}`}
                    >
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm truncate">{role === 'restaurant' ? conn.ngo : conn.restaurant}</p>
                        <p className="text-xs text-slate-500 truncate">{conn.donationItems}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Window */}
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col"
              >
                {activeConnectionId ? (
                  <>
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white">
                          <MessageSquare className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">
                            {connections.find(c => c.id === activeConnectionId)?.ngo}
                          </h3>
                          <p className="text-xs text-slate-500">Active Connection</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live</span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
                      {messages.map((msg) => (
                        <div 
                          key={msg.id} 
                          className={`flex ${msg.senderUid === user?.uid ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                            msg.senderUid === user?.uid 
                              ? 'bg-orange-500 text-white rounded-tr-none' 
                              : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                          }`}>
                            <p className="text-sm font-bold mb-1 opacity-80">{msg.sender}</p>
                            <p className="text-sm leading-relaxed">{msg.text}</p>
                            <p className="text-[10px] mt-2 opacity-60 text-right">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                      <input 
                        type="text" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 px-6 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                      <button 
                        type="submit"
                        className="bg-orange-500 text-white p-3 rounded-2xl hover:bg-orange-600 transition-all active:scale-95"
                      >
                        <Send className="w-6 h-6" />
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
                    <MessageSquare className="w-16 h-16 opacity-20" />
                    <p className="font-medium">Select a connection to start chatting</p>
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {activeTab === 'connections' && (
            <motion.div
              key="connections"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold">Active Connections</h2>
                  <p className="text-slate-500">Track your current matches and pickup statuses.</p>
                </div>
                <div className="bg-orange-100 text-orange-600 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  {connections.length} Active
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {connections.map((conn) => (
                  <div key={conn.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                      <div className="flex items-center gap-6">
                        <div className="flex -space-x-4">
                          <div className="w-14 h-14 bg-slate-900 rounded-2xl border-4 border-white flex items-center justify-center text-white">
                            <Utensils className="w-6 h-6" />
                          </div>
                          <div className="w-14 h-14 bg-orange-500 rounded-2xl border-4 border-white flex items-center justify-center text-white">
                            <Building2 className="w-6 h-6" />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-bold text-xl">{conn.restaurant} <span className="text-slate-300 mx-2">→</span> {conn.ngo}</h3>
                          <p className="text-slate-500 font-medium">{conn.donationItems}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex flex-col items-end">
                          <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${
                            conn.status === 'Completed' ? 'bg-green-100 text-green-700' : 
                            conn.status === 'In Transit' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {conn.status}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1 font-bold">Matched {new Date(conn.timestamp).toLocaleDateString()}</span>
                        </div>
                        <button 
                          onClick={() => setActiveTab('chat')}
                          className="bg-slate-100 text-slate-700 px-6 py-3 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                        >
                          Open Chat
                        </button>
                        {role === 'ngo' && conn.status !== 'Completed' && (
                          <button 
                            onClick={() => setShowRatingModal(conn.id)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-orange-500/20 transition-all"
                          >
                            Mark Completed & Rate
                          </button>
                        )}
                        {conn.rated && (
                          <div className="flex items-center gap-1 text-green-600 font-bold text-sm px-4">
                            <CheckCircle2 className="w-4 h-4" />
                            Rated
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <h2 className="text-3xl font-bold">Settings</h2>
              
              <div className="space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-orange-500" />
                    Profile Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Display Name</label>
                      <input type="text" defaultValue={role === 'restaurant' ? 'Pasta Palace' : 'City Rescue Mission'} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                      <input type="email" defaultValue="contact@foodbridge.org" className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-blue-500" />
                    Location Services
                  </h3>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="bg-white p-3 rounded-xl shadow-sm">
                        <MapPin className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">Real-time Detection</p>
                        <p className="text-xs text-slate-500">{location ? `Lat: ${location.lat.toFixed(4)}, Lng: ${location.lng.toFixed(4)}` : 'Detecting location...'}</p>
                      </div>
                    </div>
                    <div className="w-12 h-6 bg-orange-500 rounded-full relative">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Bell className="w-5 h-5 text-orange-500" />
                    Notification Settings
                  </h3>
                  <div className="space-y-4">
                    {[
                      { key: 'newDonations', label: 'New Donations Nearby', desc: 'Get notified when food is available in your area.' },
                      { key: 'chatMessages', label: 'Chat Messages', desc: 'Receive alerts for new messages in active connections.' },
                      { key: 'pickupReminders', label: 'Pickup Reminders', desc: 'Stay updated on upcoming food pickup deadlines.' }
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <div>
                          <p className="font-bold text-sm">{item.label}</p>
                          <p className="text-xs text-slate-500">{item.desc}</p>
                        </div>
                        <button 
                          onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof notifications] }))}
                          className={`w-12 h-6 rounded-full relative transition-colors ${notifications[item.key as keyof typeof notifications] ? 'bg-orange-500' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifications[item.key as keyof typeof notifications] ? 'right-1' : 'left-1'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-green-500" />
                    Security
                  </h3>
                  <button className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all flex items-center justify-between group">
                    <span className="font-bold text-sm">Change Password</span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button className="w-full text-left p-4 bg-red-50 hover:bg-red-100 rounded-2xl transition-all flex items-center justify-between group">
                    <span className="font-bold text-sm text-red-600">Delete Account</span>
                    <ChevronRight className="w-4 h-4 text-red-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-orange-500 p-1.5 rounded-lg">
                <Heart className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-lg">FoodBridge</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              Making food donation simple, transparent, and impactful for everyone.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold mb-4">Platform</h4>
            <ul className="space-y-2 text-slate-500 text-sm">
              <li><button onClick={() => setActiveTab('donate')} className="hover:text-orange-500">Donate Food</button></li>
              <li><button onClick={() => setActiveTab('ngos')} className="hover:text-orange-500">NGO Directory</button></li>
              <li><button onClick={() => setActiveTab('impact')} className="hover:text-orange-500">Impact Stories</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4">Company</h4>
            <ul className="space-y-2 text-slate-500 text-sm">
              <li><a href="#" className="hover:text-orange-500">About Us</a></li>
              <li><a href="#" className="hover:text-orange-500">Careers</a></li>
              <li><a href="#" className="hover:text-orange-500">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4">Newsletter</h4>
            <p className="text-slate-500 text-sm mb-4">Stay updated with our latest impact reports.</p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Email"
                className="bg-slate-100 border-none rounded-xl px-4 py-2 text-sm flex-1 focus:ring-2 focus:ring-orange-500 outline-none"
              />
              <button className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800">
                Join
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-slate-100 text-center text-slate-400 text-xs">
          © 2026 FoodBridge NGO Connect. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
