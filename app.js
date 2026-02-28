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
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
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

// --- SPLASH SCREEN ---
const Splash = ({ onLogout, user }) => {
    const handleNavigate = (url) => {
        window.open(url, '_blank');
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-12 relative">
            {/* Botón de logout */}
            <button
                onClick={onLogout}
                className="absolute top-6 right-6 p-3 glass rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all border-white/10"
                title="Cerrar sesión"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16,17 21,12 16,7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
            </button>

            <div className="text-center space-y-4">
                <h1 className="text-6xl md:text-8xl font-extrabold gradient-text tracking-tight uppercase">
                    Edita como un Pro
                </h1>
                <p className="text-gray-300 text-lg md:text-2xl font-light max-w-2xl mx-auto">
                    <span className="neon-text font-semibold">Generación/Edición/Estilos Visuales de Imágenes</span>
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 w-full max-w-[95rem]">
                {/* Botón Generar Imagen */}
                <button
                    onClick={() => handleNavigate('https://atnojs.es/apps/imagenes_ia/generar/index.html')}
                    className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-purple-500/30"
                >
                    <div className="absolute top-0 right-0 p-6 text-purple-500/10 transform group-hover:scale-150 group-hover:rotate-12 transition-transform duration-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                    </div>
                    <div className="bg-purple-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-purple-400 mb-4 border border-purple-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z" /><path d="m14 7 3 3" /><path d="M5 6v4" /><path d="M19 14v4" /><path d="M10 2v2" /><path d="M7 8H3" /><path d="M21 16h-4" /><path d="M11 3H9" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold">Generar Imagen</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">Genera imágenes desde texto.</p>
                </button>

                {/* Botón Editar Imágenes */}
                <button
                    onClick={() => handleNavigate('https://atnojs.es/apps/imagenes_ia/editar/index.html')}
                    className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-cyan-500/30"
                >
                    <div className="absolute top-0 right-0 p-6 text-cyan-500/10 transform group-hover:scale-150 group-hover:-rotate-12 transition-transform duration-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>
                    </div>
                    <div className="bg-cyan-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-cyan-400 mb-4 border border-cyan-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold">Editar Imágenes</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">Edita con Nano Banana Pro.</p>
                </button>

                {/* Botón Ajustar Imágenes */}
                <button
                    onClick={() => handleNavigate('https://atnojs.es/apps/imagenes_ia/ajustes_imagen/index.html')}
                    className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-emerald-500/30"
                >
                    <div className="absolute top-0 right-0 p-6 text-emerald-500/10 transform group-hover:scale-150 group-hover:rotate-6 transition-transform duration-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M12 2L2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></svg>
                    </div>
                    <div className="bg-emerald-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-400 mb-4 border border-emerald-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold">Ajustar Imágenes</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">Corrige brillo, saturación y más.</p>
                </button>

                {/* Botón Combinar Imágenes */}
                <button
                    onClick={() => handleNavigate('https://atnojs.es/apps/imagenes_ia/combinar_imagenes/index.html')}
                    className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-pink-500/30"
                >
                    <div className="absolute top-0 right-0 p-6 text-pink-500/10 transform group-hover:scale-150 group-hover:-rotate-12 transition-transform duration-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /></svg>
                    </div>
                    <div className="bg-pink-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-pink-400 mb-4 border border-pink-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold">Combinar Imágenes</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">Fusiona varias imágenes con IA.</p>
                </button>

                {/* Botón Copiar Estilo (NUEVO - 5TO BOTÓN) */}
                <button
                    onClick={() => handleNavigate('https://atnojs.es/apps/imagenes_ia/copiar_estilo/index.html')}
                    className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-blue-500/30"
                >
                    <div className="absolute top-0 right-0 p-6 text-blue-500/10 transform group-hover:scale-150 group-hover:rotate-12 transition-transform duration-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                    </div>
                    <div className="bg-blue-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-blue-400 mb-4 border border-blue-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold">Copiar Estilo</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">Transfiere estilos visuales.</p>
                </button>

                {/* Botón Illusion Diffusion (NUEVO - 6TO BOTÓN) */}
                <button
                    onClick={() => handleNavigate('https://atnojs.es/apps/imagenes_ia/illusion_diffusion/index.html')}
                    className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-orange-500/30"
                >
                    <div className="absolute top-0 right-0 p-6 text-orange-500/10 transform group-hover:scale-150 group-hover:-rotate-12 transition-transform duration-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="12" cy="12" r="10" /><path d="m14.31 8 5.74 9.94" /><path d="M9.69 8h11.48" /><path d="m7.38 12 5.74-9.94" /><path d="M9.69 16 3.95 6.06" /><path d="M14.31 16H2.83" /><path d="m16.62 12-5.74 9.94" /></svg>
                    </div>
                    <div className="bg-orange-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-orange-400 mb-4 border border-orange-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="m14.31 8 5.74 9.94" /><path d="M9.69 8h11.48" /><path d="m7.38 12 5.74-9.94" /><path d="M9.69 16 3.95 6.06" /><path d="M14.31 16H2.83" /><path d="m16.62 12-5.74 9.94" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold">Illusion Diffusion</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">Crea ilusiones ópticas.</p>
                </button>
            </div>

            {/* Segunda Fila (4 Botones centrados) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-[63rem]">
                {/* Botón Decorar Habitación */}
                <button
                    onClick={() => handleNavigate('https://atnojs.es/apps/decorar_habitacion/index.html')}
                    className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-indigo-500/30"
                >
                    <div className="absolute top-0 right-0 p-6 text-indigo-500/10 transform group-hover:scale-150 group-hover:rotate-12 transition-transform duration-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
                    </div>
                    <div className="bg-indigo-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-indigo-400 mb-4 border border-indigo-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold">Decorar Habitación</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">Rediseña interiores con IA.</p>
                </button>

                {/* Botón Color */}
                <button
                    onClick={() => handleNavigate('https://atnojs.es/apps/color/index.html')}
                    className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-amber-500/30"
                >
                    <div className="absolute top-0 right-0 p-6 text-amber-500/10 transform group-hover:scale-150 group-hover:-rotate-12 transition-transform duration-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg>
                    </div>
                    <div className="bg-amber-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-amber-400 mb-4 border border-amber-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold">Color</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">Colorea imágenes con IA.</p>
                </button>

                {/* Botón Dibujo Líneas */}
                <button
                    onClick={() => handleNavigate('https://atnojs.es/apps/dibujo_lineas/index.html')}
                    className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-teal-500/30"
                >
                    <div className="absolute top-0 right-0 p-6 text-teal-500/10 transform group-hover:scale-150 group-hover:rotate-6 transition-transform duration-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>
                    </div>
                    <div className="bg-teal-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-teal-400 mb-4 border border-teal-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold">Dibujo Líneas</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">Arte lineal desde fotos.</p>
                </button>

                {/* Botón Clonador */}
                <button
                    onClick={() => handleNavigate('https://atnojs.es/apps/clonador/index.html')}
                    className="group glass glass-hover relative p-10 rounded-[2.5rem] text-left space-y-4 overflow-hidden border-rose-500/30"
                >
                    <div className="absolute top-0 right-0 p-6 text-rose-500/10 transform group-hover:scale-150 group-hover:-rotate-12 transition-transform duration-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                    </div>
                    <div className="bg-rose-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-rose-400 mb-4 border border-rose-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold">Clonador</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">Face swap con IA.</p>
                </button>
            </div>

            {/* Info de usuario */}
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

    React.useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        await auth.signOut();
        setUser(null);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <svg className="animate-spin text-cyan-400" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
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
                <Splash onLogout={handleLogout} user={user} />
            )}
        </div>
    );
};

// --- RENDER ---
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
