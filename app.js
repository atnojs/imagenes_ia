// --- FIREBASE CONFIG (ACTUALIZADA A NANOBANANA) ---
const firebaseConfig = {
    apiKey: "AIzaSyAlTZgodkiHACqJSRcDqymTdvaegBdLZMk",
    authDomain: "nanobanana-cbb2d.firebaseapp.com",
    projectId: "nanobanana-cbb2d",
    storageBucket: "nanobanana-cbb2d.firebasestorage.app",
    messagingSenderId: "490656740654",
    appId: "1:490656740654:web:104f76973c1254d5b876bf",
    measurementId: "G-8XK035PGTV"
};

// Inicialización de Firebase con la nueva configuración
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const ADMIN_EMAIL = "atnojs@gmail.com";
const DAILY_LIMIT = 8;

// --- HELPERS FIREBASE ---
const getTodayDateString = () => new Date().toISOString().split('T')[0];

// Forzar logout al cargar la página para siempre pedir login
auth.signOut();

// --- ICONOS (usando Lucide global) ---
const Icon = ({ name, size = 24, className = "" }) => {
    const ref = React.useRef(null);
    React.useEffect(() => {
        if (ref.current && window.lucide) {
            ref.current.innerHTML = `<i data-lucide="${name}"></i>`;
            window.lucide.createIcons({ icons: { [name]: true }, attrs: { width: size, height: size } });
        }
    }, [name, size]);
    return <span ref={ref} className={className}></span>;
};

// --- LOGIN MODAL ---
const LoginModal = ({ onLogin }) => {
    const [isLogin, setIsLogin] = React.useState(true);
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            let userCredential;
            if (isLogin) {
                userCredential = await auth.signInWithEmailAndPassword(email, password);
            } else {
                userCredential = await auth.createUserWithEmailAndPassword(email, password);
                await db.collection('users').doc(userCredential.user.uid).set({
                    email: userCredential.user.email,
                    role: 'free',
                    usageCount: 0,
                    lastDate: new Date().toISOString().split('T')[0],
                    lastActive: Date.now()
                });
            }
            onLogin(userCredential.user);
        } catch (err) {
            setError(err.message.includes('auth/') ? 'Credenciales inválidas' : err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setLoading(true);
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            // Forzar que siempre pida seleccionar cuenta
            provider.setCustomParameters({ prompt: 'select_account' });
            const result = await auth.signInWithPopup(provider);
            const userDoc = await db.collection('users').doc(result.user.uid).get();
            if (!userDoc.exists) {
                await db.collection('users').doc(result.user.uid).set({
                    email: result.user.email,
                    role: 'free',
                    usageCount: 0,
                    lastDate: new Date().toISOString().split('T')[0],
                    lastActive: Date.now()
                });
            }
            onLogin(result.user);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass-modal w-full max-w-md p-8 rounded-3xl">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-cyan-500/20 rounded-2xl flex items-center justify-center text-cyan-400 mx-auto mb-4 border border-cyan-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11V7a5 5 0 0 1 10 0v4" /><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /></svg>
                    </div>
                    <h2 className="text-3xl font-bold text-white">
                        {isLogin ? 'Bienvenido' : 'Crear Cuenta'}
                    </h2>
                    <p className="text-gray-400 text-sm mt-2">
                        {isLogin ? 'Inicia sesión para continuar' : 'Regístrate para acceder'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full py-4 pl-12 pr-4 rounded-xl text-sm"
                            required
                        />
                    </div>
                    <div className="relative">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        <input
                            type="password"
                            placeholder="Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full py-4 pl-12 pr-4 rounded-xl text-sm"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:from-cyan-500 hover:to-blue-600 transition-all disabled:opacity-50"
                    >
                        {loading ? (
                            <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                        ) : (isLogin ? 'Entrar' : 'Crear Cuenta')}
                    </button>
                </form>

                <div className="mt-6 flex items-center gap-4 text-gray-500">
                    <div className="h-px bg-white/10 flex-1"></div>
                    <span className="text-xs font-bold uppercase">O accede con</span>
                    <div className="h-px bg-white/10 flex-1"></div>
                </div>

                <button
                    onClick={handleGoogle}
                    disabled={loading}
                    className="mt-6 w-full py-4 glass border-white/10 hover:bg-white/5 rounded-xl flex items-center justify-center gap-3 text-gray-300 font-bold text-sm transition-all disabled:opacity-50"
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                    Google
                </button>

                <p className="mt-8 text-center text-xs text-gray-500">
                    {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="ml-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                        {isLogin ? 'Regístrate' : 'Inicia sesión'}
                    </button>
                </p>
            </div>
        </div>
    );
};

// --- COMPONENTE: PANEL DE ADMINISTRADOR ---
const AdminPanel = ({ onClose }) => {
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [stats, setStats] = React.useState(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedTab, setSelectedTab] = React.useState('overview');
    const [lastRefresh, setLastRefresh] = React.useState(null);

    const today = getTodayDateString();

    const safeDate = (ts) => {
        try {
            if (!ts) return null;
            if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
            if (ts instanceof Date) return ts;
            const d = new Date(ts);
            return isNaN(d.getTime()) ? null : d;
        } catch {
            return null;
        }
    };

    const formatDateTime = (d) => {
        if (!d) return '-';
        return d.toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const exportUsersCSV = () => {
        if (!users || users.length === 0) return;
        const headers = ['UID', 'Email', 'Uso hoy', 'Última actividad'];
        const rows = users.map(u => {
            const usageToday = u.todayUsage ?? 0;
            const lastActive = u.lastActive ? new Date(u.lastActive.seconds * 1000).toISOString() : '';
            return [`"${u.id}"`, `"${u.email || ''}"`, usageToday, `"${lastActive}"`].join(',');
        });
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'usuarios_admin.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const computeStats = (usersData) => {
        const now = Date.now();
        const last24hMs = 24 * 60 * 60 * 1000;
        const total = usersData.length;
        const activeToday = usersData.filter(u => (u.todayUsage || 0) > 0).length;
        const limitReached = usersData.filter(u => (u.todayUsage || 0) >= DAILY_LIMIT).length;
        const totalUsageToday = usersData.reduce((s, u) => s + (u.todayUsage || 0), 0);
        const avgUsageActive = activeToday > 0 ? (totalUsageToday / activeToday) : 0;
        const last24hActive = usersData.filter(u => u.lastActiveDate && (now - u.lastActiveDate.getTime()) <= last24hMs).length;
        const topUsers = [...usersData].sort((a, b) => (b.todayUsage || 0) - (a.todayUsage || 0)).slice(0, 8);
        const roleCounts = usersData.reduce((acc, u) => {
            const role = u.role || 'user';
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {});
        setStats({ total, activeToday, last24hActive, totalUsageToday, avgUsageActive, limitReached, roleCounts, topUsers });
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const snapshot = await db.collection('users').limit(300).get();
            const usersData = await Promise.all(snapshot.docs.map(async (doc) => {
                const data = doc.data() || {};
                const usageDoc = await doc.ref.collection('usage').doc(today).get();
                const todayUsage = usageDoc.exists ? (usageDoc.data()?.count || 0) : 0;
                const email = data.email || '';
                const role = data.role || (email === ADMIN_EMAIL ? 'admin' : 'user');
                const lastActiveDate = safeDate(data.lastActive);
                return { uid: doc.id, email, role, todayUsage, lastActiveRaw: data.lastActive || null, lastActiveDate, lastActiveText: formatDateTime(lastActiveDate) };
            }));
            usersData.sort((a, b) => (b.lastActiveDate?.getTime() || 0) - (a.lastActiveDate?.getTime() || 0));
            setUsers(usersData);
            computeStats(usersData);
            setLastRefresh(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (e) {
            console.error('Error loading admin data:', e);
            alert('Error cargando datos de Firestore: ' + (e?.message || e));
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        loadData();
        const intervalId = setInterval(loadData, 30000);
        return () => clearInterval(intervalId);
    }, []);

    const resetTodayUsage = async (uid) => {
        try {
            await db.collection('users').doc(uid).collection('usage').doc(today).set({ count: 0 }, { merge: true });
            await loadData();
        } catch (e) { alert('Error reseteando uso: ' + e.message); }
    };

    const setRole = async (uid, newRole) => {
        try {
            await db.collection('users').doc(uid).set({ role: newRole }, { merge: true });
            await loadData();
        } catch (e) { alert('Error actualizando rol: ' + e.message); }
    };

    const deleteUserDoc = async (uid, email) => {
        if (!confirm(`¿Eliminar el usuario en Firestore?\n\n ${email || uid}`)) return;
        try {
            await db.collection('users').doc(uid).delete();
            await loadData();
        } catch (e) { alert('Error eliminando usuario: ' + e.message); }
    };

    const filteredUsers = users.filter(u => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;
        return (u.email || '').toLowerCase().includes(q) || (u.uid || '').toLowerCase().includes(q);
    });

    const StatCard = ({ icon, label, value, subtext, accent = 'from-cyan-400 to-violet-400' }) => (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-5 shadow-xl">
            <div className={`absolute -top-10 -right-10 h-28 w-28 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl`} />
            <div className="relative flex items-start gap-3">
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${accent} opacity-90 flex items-center justify-center text-slate-950 font-black`}>{icon}</div>
                <div className="flex-1">
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">{label}</div>
                    <div className="text-2xl font-extrabold text-white leading-tight">{value}</div>
                    {subtext && <div className="mt-1 text-xs text-slate-400">{subtext}</div>}
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-6xl max-h-[90vh] rounded-3xl overflow-hidden border border-white/10 bg-slate-950/70 shadow-2xl flex flex-col">
                <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-red-400 to-amber-300 flex items-center justify-center text-slate-950 font-black">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-extrabold text-white leading-tight">Panel Admin</h2>
                            <p className="text-sm text-slate-400">{lastRefresh ? `Actualizado: ${lastRefresh}` : 'Cargando...'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm font-bold">✕ Cerrar</button>
                </div>
                <div className="flex-1 overflow-auto p-6">
                    {loading ? <div className="text-center py-20 text-white">Cargando...</div> : (
                        <div className="space-y-6">
                            {selectedTab === 'overview' && stats && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <StatCard icon="👥" label="Total" value={stats.total} />
                                        <StatCard icon="🔥" label="Activos" value={stats.activeToday} accent="from-amber-300 to-red-400" />
                                        <StatCard icon="📈" label="Uso" value={stats.totalUsageToday} accent="from-emerald-300 to-cyan-300" />
                                        <StatCard icon="⏱️" label="24h" value={stats.last24hActive} accent="from-violet-300 to-fuchsia-300" />
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {stats.topUsers.map(u => (
                                            <div key={u.uid} className="p-4 glass rounded-xl flex justify-between items-center">
                                                <div className="truncate"><div className="font-bold text-white">{u.email}</div><div className="text-xs text-gray-500">{u.uid}</div></div>
                                                <div className="font-bold text-cyan-400">{u.todayUsage} / {DAILY_LIMIT}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- SPLASH SCREEN ---
const Splash = ({ onLogout, user, isAdmin, onAdminOpen }) => {
    const handleNavigate = (url) => { window.open(url, '_blank'); };

    return (
        <div className="min-h-screen flex flex-col items-center p-6 pt-16 pb-20 space-y-12 relative overflow-y-auto w-full">
            <div className="absolute top-6 right-6 flex items-center gap-3">
                {isAdmin && (
                    <button onClick={onAdminOpen} className="px-3 py-2 glass rounded-xl text-red-300 border border-red-500/30 text-xs font-bold">ADMIN</button>
                )}
                <button onClick={onLogout} className="p-3 glass rounded-xl text-gray-400 border border-white/10 hover:text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16,17 21,12 16,7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                </button>
            </div>

            <div className="text-center space-y-4 pt-12">
                <h1 className="text-6xl md:text-8xl font-extrabold gradient-text uppercase tracking-tight">Edita como un Pro</h1>
                <p className="text-gray-300 text-lg md:text-2xl font-light max-w-2xl mx-auto"><span className="neon-text font-semibold">Generación/Edición/Estilos Visuales de Imágenes</span></p>
            </div>

            <div className="flex flex-col items-center gap-6 w-full max-w-[120rem]">
                {/* Primera Fila (6 Botones) */}
                <div className="flex flex-wrap justify-center gap-6 w-full">
                    {/* Botón Generar Imagen */}
                    <button onClick={() => handleNavigate('https://atnojs.es/apps/imagenes_ia/generar/index.html')} className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-purple-500/30 w-full md:w-[calc(33.333%-1.5rem)] lg:w-[calc(16.666%-1.5rem)] min-w-[240px]">
                        <div className="absolute top-0 right-0 p-6 text-purple-500/10 transform group-hover:scale-150 transition-transform duration-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                        </div>
                        <div className="bg-purple-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-purple-400 mb-4 border border-purple-500/30">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z" /><path d="m14 7 3 3" /><path d="M5 6v4" /><path d="M19 14v4" /><path d="M10 2v2" /><path d="M7 8H3" /><path d="M21 16h-4" /><path d="M11 3H9" /></svg>
                        </div>
                        <h2 className="text-2xl font-bold">Generar Imagen</h2>
                        <p className="text-gray-400 text-sm">Genera imágenes desde texto.</p>
                    </button>

                    {/* Botón Editar Imágenes */}
                    <button onClick={() => handleNavigate('https://atnojs.es/apps/imagenes_ia/editar/index.html')} className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-cyan-500/30 w-full md:w-[calc(33.333%-1.5rem)] lg:w-[calc(16.666%-1.5rem)] min-w-[240px]">
                        <div className="bg-cyan-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-cyan-400 mb-4 border border-cyan-500/30">
                            <Icon name="wand-2" size={28} />
                        </div>
                        <h2 className="text-2xl font-bold">Editar Imágenes</h2>
                        <p className="text-gray-400 text-sm">Edita con Nano Banana Pro.</p>
                    </button>

                    {/* Botón Ajustar Imágenes */}
                    <button onClick={() => handleNavigate('https://atnojs.es/apps/imagenes_ia/ajustes_imagen/index.html')} className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-emerald-500/30 w-full md:w-[calc(33.333%-1.5rem)] lg:w-[calc(16.666%-1.5rem)] min-w-[240px]">
                        <div className="bg-emerald-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-400 mb-4 border border-emerald-500/30">
                            <Icon name="sliders" size={28} />
                        </div>
                        <h2 className="text-2xl font-bold">Ajustar Imágenes</h2>
                        <p className="text-gray-400 text-sm">Corrección de color y más.</p>
                    </button>

                    {/* Botón Combinar Imágenes */}
                    <button onClick={() => handleNavigate('https://atnojs.es/apps/imagenes_ia/combinar_imagenes/index.html')} className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-pink-500/30 w-full md:w-[calc(33.333%-1.5rem)] lg:w-[calc(16.666%-1.5rem)] min-w-[240px]">
                        <div className="bg-pink-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-pink-400 mb-4 border border-pink-500/30">
                            <Icon name="layers" size={28} />
                        </div>
                        <h2 className="text-2xl font-bold">Combinar Imágenes</h2>
                        <p className="text-gray-400 text-sm">Fusiona imágenes con IA.</p>
                    </button>

                    {/* Botón Copiar Estilo */}
                    <button onClick={() => handleNavigate('https://atnojs.es/apps/copiar_estilo/index.html')} className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-blue-500/30 w-full md:w-[calc(33.333%-1.5rem)] lg:w-[calc(16.666%-1.5rem)] min-w-[240px]">
                        <div className="bg-blue-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-blue-400 mb-4 border border-blue-500/30">
                            <Icon name="copy" size={28} />
                        </div>
                        <h2 className="text-2xl font-bold">Copiar Estilo</h2>
                        <p className="text-gray-400 text-sm">Transfiere estilos visuales.</p>
                    </button>

                    {/* Botón Illusion Diffusion */}
                    <button onClick={() => handleNavigate('https://atnojs.es/apps/illusion_diffusion/index.html')} className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-orange-500/30 w-full md:w-[calc(33.333%-1.5rem)] lg:w-[calc(16.666%-1.5rem)] min-w-[240px]">
                        <div className="bg-orange-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-orange-400 mb-4 border border-orange-500/30">
                            <Icon name="circle-dashed" size={28} />
                        </div>
                        <h2 className="text-2xl font-bold">Illusion Diffusion</h2>
                        <p className="text-gray-400 text-sm">Crea ilusiones ópticas.</p>
                    </button>
                </div>

                {/* Segunda Fila (Resto Centrados) */}
                <div className="flex flex-wrap justify-center gap-6 w-full">
                    {/* Botón Decorar Habitación */}
                    <button onClick={() => handleNavigate('https://atnojs.es/apps/decorar_habitacion/index.html')} className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-indigo-500/30 w-full md:w-[calc(33.333%-1.5rem)] lg:w-[calc(16.666%-1.5rem)] min-w-[240px]">
                        <div className="bg-indigo-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-indigo-400 mb-4 border border-indigo-500/30">
                            <Icon name="home" size={28} />
                        </div>
                        <h2 className="text-2xl font-bold">Decorar Habitación</h2>
                        <p className="text-gray-400 text-sm">Rediseña interiores con IA.</p>
                    </button>

                    {/* Botón Color */}
                    <button onClick={() => handleNavigate('https://atnojs.es/apps/color/index.html')} className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-amber-500/30 w-full md:w-[calc(33.333%-1.5rem)] lg:w-[calc(16.666%-1.5rem)] min-w-[240px]">
                        <div className="bg-amber-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-amber-400 mb-4 border border-amber-500/30">
                            <Icon name="palette" size={28} />
                        </div>
                        <h2 className="text-2xl font-bold">Color</h2>
                        <p className="text-gray-400 text-sm">Colorea imágenes con IA.</p>
                    </button>

                    {/* Botón Dibujo Líneas */}
                    <button onClick={() => handleNavigate('https://atnojs.es/apps/dibujo_lineas/index.html')} className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-emerald-500/30 w-full md:w-[calc(33.333%-1.5rem)] lg:w-[calc(16.666%-1.5rem)] min-w-[240px]">
                        <div className="bg-emerald-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-400 mb-4 border border-emerald-500/30">
                            <Icon name="pen-tool" size={28} />
                        </div>
                        <h2 className="text-2xl font-bold">Dibujo Líneas</h2>
                        <p className="text-gray-400 text-sm">Arte lineal desde fotos.</p>
                    </button>

                    {/* Botón Clonador */}
                    <button onClick={() => handleNavigate('https://atnojs.es/apps/clonador/index.html')} className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-rose-500/30 w-full md:w-[calc(33.333%-1.5rem)] lg:w-[calc(16.666%-1.5rem)] min-w-[240px]">
                        <div className="bg-rose-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-rose-400 mb-4 border border-rose-500/30">
                            <Icon name="users" size={28} />
                        </div>
                        <h2 className="text-2xl font-bold">Clonador</h2>
                        <p className="text-gray-400 text-sm">Face swap con IA.</p>
                    </button>
                </div>
            </div>

            {user && (
                <div className="text-center text-xs text-gray-500 mt-8">
                    Conectado como: <span className="text-cyan-400">{user.email}</span>
                </div>
            )}
        </div>
    );
};

// --- APP PRINCIPAL ---
const App = () => {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [adminPanelOpen, setAdminPanelOpen] = React.useState(false);

    React.useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((u) => {
            setUser(u);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        await auth.signOut();
        setUser(null);
    };

    const isAdmin = user && user.email === ADMIN_EMAIL;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <svg className="animate-spin text-cyan-400" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative">
            {!user ? (
                <>
                    <div className="filter blur-sm pointer-events-none">
                        <Splash onLogout={() => { }} user={null} />
                    </div>
                    <LoginModal onLogin={setUser} />
                </>
            ) : (
                <>
                    <Splash onLogout={handleLogout} user={user} isAdmin={isAdmin} onAdminOpen={() => setAdminPanelOpen(true)} />
                    {adminPanelOpen && <AdminPanel onClose={() => setAdminPanelOpen(false)} />}
                </>
            )}
        </div>
    );
};

// --- RENDER ---
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
