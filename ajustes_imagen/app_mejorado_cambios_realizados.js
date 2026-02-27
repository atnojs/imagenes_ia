const { useState, useRef, useEffect, useCallback } = React;

// --- CONFIGURACIÓN FIREBASE & CONSTANTES ---
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAlTZgodkiHACqJSRcDqymTdvaegBdLZMk",
    authDomain: "nanobanana-cbb2d.firebaseapp.com",
    projectId: "nanobanana-cbb2d",
    storageBucket: "nanobanana-cbb2d.firebasestorage.app",
    messagingSenderId: "490656740654",
    appId: "1:490656740654:web:104f76973c1254d5b876bf",
    measurementId: "G-8XK035PGTV"
};

const ADMIN_EMAIL = "atnojs@gmail.com";
const DAILY_LIMIT = 8;

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
}
const auth = firebase.auth();
const db = firebase.firestore();

// --- HELPERS FIREBASE ---
const getTodayDateString = () => new Date().toISOString().split('T')[0];

const checkAndIncrementDailyUsage = async (userId) => {
    if (!userId) throw new Error("Usuario no identificado");
    const today = getTodayDateString();
    const userRef = db.collection('users').doc(userId);
    const usageRef = userRef.collection('usage').doc(today);

    // Ejecutar transacción para evitar condiciones de carrera
    return db.runTransaction(async (transaction) => {
        const usageDoc = await transaction.get(usageRef);
        const currentCount = usageDoc.exists ? usageDoc.data().count : 0;

        // Si es admin, bypass
        if (auth.currentUser.email === ADMIN_EMAIL) {
            return { allowed: true, count: currentCount };
        }

        if (currentCount >= DAILY_LIMIT) {
            throw new Error(`Has alcanzado tu límite diario de ${DAILY_LIMIT} imágenes.`);
        }

        transaction.set(usageRef, { count: currentCount + 1 }, { merge: true });
        // Actualizar último acceso del usuario
        transaction.set(userRef, { lastActive: new Date(), email: auth.currentUser.email }, { merge: true });

        return { allowed: true, count: currentCount + 1 };
    });
};

// Descripciones de los efectos para los tooltips
const EFFECT_DESCRIPTIONS = {
    brightness: "Ajusta el brillo general de la imagen. Valores más altos hacen la imagen más brillante.",
    contrast: "Controla la diferencia entre las áreas claras y oscuras. Aumenta para mayor impacto visual.",
    saturation: "Intensifica o reduce la intensidad de todos los colores de la imagen.",
    hue: "Desplaza todos los colores a lo largo del espectro de color. Útil para crear efectos de color creativos.",
    blur: "Aplica un desenfoque suave a toda la imagen. Ideal para crear efectos de sueño o profundidad.",
    exposure: "Simula la exposición de una cámara. Aumenta para iluminar áreas oscuras o disminuye para oscurecer áreas claras.",
    temperature: "Ajusta la temperatura de color. Valores altos tonos cálidos (amarillentos), valores bajos tonos fríos (azulados).",
    vignette: "Añade un efecto de viñeta oscureciendo los bordes de la imagen. Crea un punto focal en el centro.",
    scale: "Amplía o reduce el tamaño de la imagen sin cambiar sus proporciones.",
    rotation: "Gira la imagen en el sentido de las agujas del reloj.",
    clarity: "Mejora la claridad y definición de la imagen. Aumenta el contraste local sin afectar los tonos extremos.",
    vibrance: "Intensifica los colores menos saturados de forma inteligente, preservando los tonos de piel.",
    noiseReduction: "Reduce el ruido digital y la granulosidad de la imagen, especialmente en áreas de bajo contraste.",
    sharpening: "Aumenta la nitidez de los bordes y detalles de la imagen. Útil para resaltar texturas.",
    filmGrain: "Añade un efecto de grano cinematográfico para dar un aspecto vintage o artístico.",
    midtoneContrast: "Ajusta el contraste solo en los tonos medios, dejando intactas las áreas muy claras y muy oscuras.",
    hdrEffect: "Simula un efecto HDR (High Dynamic Range) expandiendo el rango dinámico de la imagen.",
    ortonEffect: "Crea un efecto etéreo similar al de las fotografías de Michael Orton, combinando la imagen con una versión desenfocada.",
    focalBlur: "Desenfoca selectivamente el fondo manteniendo nítido el sujeto principal. Crea profundidad de campo.",
    whiteBalance_temp: "Ajusta la temperatura de color para corregir dominantes de color. Valores altos para tonos cálidos, bajos para fríos.",
    whiteBalance_tint: "Ajusta el tinte magenta-verde para corregir dominantes de color. Valores altos para magenta, bajos para verde."
};

// Reemplazar completamente el objeto INITIAL_SETTINGS existente
const INITIAL_SETTINGS = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
    exposure: 0,
    temperature: 0,
    vignette: 0,
    scale: 100,
    rotation: 0,
    panX: 0,
    panY: 0,
    // Nuevas funcionalidades locales
    focalBlur: 0,
    focalPoint: { x: 50, y: 50 },
    clarity: 0,
    vibrance: 0,
    noiseReduction: 0,
    sharpening: 0,
    filmGrain: 0,
    midtoneContrast: 0,
    hdrEffect: 0,
    ortonEffect: 0,
    whiteBalance: { temperature: 0, tint: 0 }
};

// Funciones auxiliares para efectos locales
const applyNoiseReduction = (imageData, strength) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const output = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            for (let c = 0; c < 3; c++) {
                let sum = 0;
                let count = 0;

                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const idx = ((y + dy) * width + (x + dx)) * 4 + c;
                        sum += data[idx];
                        count++;
                    }
                }

                const idx = (y * width + x) * 4 + c;
                output[idx] = data[idx] * (1 - strength) + (sum / count) * strength;
            }
        }
    }

    for (let i = 0; i < data.length; i++) {
        data[i] = output[i];
    }
};

const applySharpening = (imageData, amount) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const output = new Uint8ClampedArray(data);

    const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
    ];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            for (let c = 0; c < 3; c++) {
                let sum = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                        const kidx = (ky + 1) * 3 + (kx + 1);
                        sum += data[idx] * kernel[kidx];
                    }
                }

                const idx = (y * width + x) * 4 + c;
                output[idx] = Math.min(255, Math.max(0,
                    data[idx] * (1 - amount) + sum * amount
                ));
            }
        }
    }

    for (let i = 0; i < data.length; i++) {
        data[i] = output[i];
    }
};

// Función para generar una descripción de los efectos aplicados
const getEffectsDescription = (settings) => {
    const effects = [];

    if (settings.brightness !== 100) {
        effects.push(`Brillo: ${settings.brightness > 100 ? '+' : ''}${settings.brightness - 100}%`);
    }
    if (settings.contrast !== 100) {
        effects.push(`Contraste: ${settings.contrast > 100 ? '+' : ''}${settings.contrast - 100}%`);
    }
    if (settings.saturation !== 100) {
        effects.push(`Saturación: ${settings.saturation > 100 ? '+' : ''}${settings.saturation - 100}%`);
    }
    if (settings.hue !== 0) {
        effects.push(`Matiz: ${settings.hue}°`);
    }
    if (settings.blur !== 0) {
        effects.push(`Desenfoque: ${settings.blur}px`);
    }
    if (settings.exposure !== 0) {
        effects.push(`Exposición: ${settings.exposure > 0 ? '+' : ''}${settings.exposure}`);
    }
    if (settings.temperature !== 0) {
        effects.push(`Temperatura: ${settings.temperature > 0 ? '+' : ''}${settings.temperature}`);
    }
    if (settings.vignette !== 0) {
        effects.push(`Viñeta: ${settings.vignette}%`);
    }
    if (settings.scale !== 100) {
        effects.push(`Escala: ${settings.scale}%`);
    }
    if (settings.rotation !== 0) {
        effects.push(`Rotación: ${settings.rotation}°`);
    }
    if (settings.clarity !== 0) {
        effects.push(`Claridad: ${settings.clarity > 0 ? '+' : ''}${settings.clarity}`);
    }
    if (settings.vibrance !== 0) {
        effects.push(`Vibrancia: ${settings.vibrance > 0 ? '+' : ''}${settings.vibrance}`);
    }
    if (settings.noiseReduction !== 0) {
        effects.push(`Reducción ruido: ${settings.noiseReduction}%`);
    }
    if (settings.sharpening !== 0) {
        effects.push(`Nitidez: ${settings.sharpening}%`);
    }
    if (settings.filmGrain !== 0) {
        effects.push(`Grano cinematográfico: ${settings.filmGrain}%`);
    }
    if (settings.midtoneContrast !== 0) {
        effects.push(`Contraste medios tonos: ${settings.midtoneContrast > 0 ? '+' : ''}${settings.midtoneContrast}`);
    }
    if (settings.hdrEffect !== 0) {
        effects.push(`Efecto HDR: ${settings.hdrEffect}%`);
    }
    if (settings.ortonEffect !== 0) {
        effects.push(`Efecto Orton: ${settings.ortonEffect}%`);
    }
    if (settings.focalBlur !== 0) {
        effects.push(`Enfoque selectivo: ${settings.focalBlur}px`);
    }
    if (settings.whiteBalance.temperature !== 0) {
        effects.push(`Balance blancos (Temp): ${settings.whiteBalance.temperature > 0 ? '+' : ''}${settings.whiteBalance.temperature}`);
    }
    if (settings.whiteBalance.tint !== 0) {
        effects.push(`Balance blancos (Tint): ${settings.whiteBalance.tint > 0 ? '+' : ''}${settings.whiteBalance.tint}`);
    }

    return effects.length > 0 ? effects.join(', ') : 'Sin efectos aplicados';
};

const STYLE_PRESETS = [
    {
        id: 'lego',
        label: 'Estilo LEGO · Bloques de juguete',
        prompt: 'Convierte la imagen en un estilo LEGO: reconstruye la escena con bloques y piezas LEGO claramente visibles, con aspecto de juguete de plástico, texturas brillantes y personajes hechos de piezas angulares y extremidades cilíndricas. Mantén la composición original pero reinterpreta TODO como un mundo LEGO.'
    },
    {
        id: 'comic-americano',
        label: 'Cómic Americano · Marvel / DC',
        prompt: 'Transforma la imagen en un estilo de cómic americano al estilo Marvel/DC: contornos de líneas negras gruesas, musculatura definida, colores vivos, sombras marcadas y sombreado con patrones de puntos halftone. El resultado debe parecer una viñeta de cómic, no solo un filtro de color.'
    },
    {
        id: 'pixar',
        label: 'Pixar · 3D CGI expresivo',
        prompt: 'Reinterpreta la foto como una escena 3D CGI al estilo Pixar: personajes caricaturizados pero creíbles, rasgos suaves y muy expresivos, iluminación global detallada, materiales con textura suave y fondos coherentes. Debe verse como un fotograma de una película de Pixar.'
    },
    {
        id: 'disney-clasico',
        label: 'Disney Clásico · 2D vibrante',
        prompt: 'Convierte la imagen en animación 2D clásica de Disney: líneas fluidas y suaves, personajes con proporciones idealizadas, colores vibrantes pero naturales y sombreado suave pintado a mano. Debe parecer un dibujo animado clásico como Blancanieves o El Rey León.'
    },
    {
        id: 'cartoon-network',
        label: 'Cartoon Network · Cartoon moderno',
        prompt: 'Recrea la escena con estética de Cartoon Network moderno: personajes simples y estilizados, formas angulares o redondeadas minimalistas, paletas de color planas y llamativas y fondos simplificados. El resultado debe parecer un fotograma de una serie tipo Hora de Aventura.'
    },
    {
        id: 'tim-burton',
        label: 'Tim Burton · Gótico / Stop-motion',
        prompt: 'Transforma la imagen al estilo Tim Burton tipo stop-motion gótico: paleta oscura y apagada, personajes muy delgados y alargados con ojos grandes y expresivos, contrastes fuertes y atmósfera melancólica y caprichosa. Debe recordar a Pesadilla antes de Navidad o La novia cadáver.'
    },
    {
        id: 'claymation',
        label: 'Claymation · Plastilina',
        prompt: 'Reinterpreta la escena como si fuera claymation: todo parece modelado en plastilina o arcilla, con huellas y texturas físicas visibles en la superficie. Los personajes y objetos deben parecer figuras de plastilina tipo Wallace y Gromit, no solo un desenfoque o filtro.'
    },
    {
        id: 'pop-art',
        label: 'Pop Art · Colores planos pop',
        prompt: 'Convierte la imagen en una ilustración de Pop Art: colores planos muy brillantes, contornos marcados, uso de puntos Ben-Day y estética inspirada en Roy Lichtenstein o Andy Warhol. Debe verse como un póster pop, no como una simple foto saturada.'
    },
    {
        id: 'fotorrealista-digital',
        label: 'Fotorrealista · Pintura digital',
        prompt: 'Transforma la foto en una pintura digital fotorrealista: re-renderiza toda la escena con pincel digital, manteniendo el máximo detalle en luz, sombra y textura, de forma que parezca una ilustración pintada pero tan realista como una fotografía.'
    },
    {
        id: 'fotorrealista-cine',
        label: 'Fotorrealista · Cinemático',
        prompt: 'Reinterpreta la imagen como un fotograma cinematográfico de alto presupuesto: contraste suave, gradación de color tipo cine, profundidad de campo controlada y luz dramática. Mantén el realismo pero con look de película ancha y acabado profesional.'
    },
    {
        id: 'concept-art',
        label: 'Arte Conceptual · Concept Art',
        prompt: 'Convierte la escena en concept art: pintura digital suelta, pinceladas visibles, atmósfera marcada, luz y niebla si encaja, priorizando el mood y el diseño general por encima del detalle extremo. Debe parecer un concept de videojuego o película.'
    },
    {
        id: 'pixel-art',
        label: 'Pixel Art / 8-bit · Retro',
        prompt: 'Recrea la imagen como pixel art de baja resolución: reduce la escena a pocos píxeles grandes claramente visibles, con una paleta limitada y estética de videojuego retro 8-bit o 16-bit. Nada de desenfoques suaves: todo debe estar formado por píxeles cuadrados claros.'
    },
    {
        id: 'rubber-hose',
        label: 'Rubber Hose · Años 30 / Cuphead',
        prompt: 'Transforma la escena al estilo de animación Rubber Hose de los años 30: personajes con extremidades tipo manguera de goma, ojos simples grandes, animación rebotante congelada en un fotograma, grano ligero y estética similar a Cuphead o los primeros cortos de Disney.'
    }
];

// --- COMPONENTE: MODAL DE AUTENTICACIÓN ---
const AuthModal = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isLogin) {
                await auth.signInWithEmailAndPassword(email, password);
            } else {
                await auth.createUserWithEmailAndPassword(email, password);
            }
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                try {
                    await auth.signInWithEmailAndPassword(email, password);
                    onClose();
                    return;
                } catch (loginErr) {
                    setError(
                        'Este email ya tiene cuenta. Si te registraste con Google, usa el botón "Google".'
                    );
                    return;
                }
            }

            setError(err.message);
        }

    };

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
            await auth.signInWithPopup(provider);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="glass-modal w-full max-w-sm p-8 rounded-2xl relative">
                <div className="text-center mb-6">
                    <div className="mx-auto w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center mb-3">
                        <i data-lucide="lock" className="w-6 h-6 text-blue-400"></i>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                        {isLogin ? 'Bienvenido' : 'Crear Cuenta'}
                    </h2>
                    <p className="text-slate-400 text-sm">
                        {isLogin ? 'Inicia sesión para continuar' : 'Regístrate para guardar tu arte'}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-xs">
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <input
                            type="email"
                            placeholder="Email"
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl focus:border-blue-500 outline-none text-white placeholder-slate-500"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="Contraseña"
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl focus:border-blue-500 outline-none text-white placeholder-slate-500"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50"
                    >
                        {loading ? 'Procesando...' : (isLogin ? 'Entrar' : 'Registrarse')}
                    </button>
                </form>

                <div className="mt-4 flex items-center gap-2">
                    <div className="h-px bg-slate-700 flex-1"></div>
                    <span className="text-xs text-slate-500">O continúa con</span>
                    <div className="h-px bg-slate-700 flex-1"></div>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    type="button"
                    disabled={loading}
                    className="mt-4 w-full py-3 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                    Google
                </button>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-sm text-blue-400 hover:text-blue-300 underline"
                    >
                        {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Entra'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE: PANEL DE ADMINISTRADOR (PRO) ---
// Nota: Adaptado a tu estructura real:
// users/{uid} (email, lastActive, role?)
// users/{uid}/usage/{YYYY-MM-DD} -> { count }
const AdminPanel = ({ onClose }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTab, setSelectedTab] = useState('overview'); // overview | users

    const today = getTodayDateString();

    const safeDate = (ts) => {
        try {
            if (!ts) return null;
            // Firestore Timestamp
            if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
            // JS Date
            if (ts instanceof Date) return ts;
            // string/number
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

        const headers = [
            'UID',
            'Email',
            'Uso hoy',
            'Última actividad'
        ];

        const rows = users.map(u => {
            const usageToday = u.todayUsage ?? 0;
            const lastActive = u.lastActive
                ? new Date(u.lastActive.seconds * 1000).toISOString()
                : '';

            return [
                `"${u.id}"`,
                `"${u.email || ''}"`,
                usageToday,
                `"${lastActive}"`
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');

        const blob = new Blob(
            [csvContent],
            { type: 'text/csv;charset=utf-8;' }
        );

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

        const topUsers = [...usersData]
            .sort((a, b) => (b.todayUsage || 0) - (a.todayUsage || 0))
            .slice(0, 8);

        const roleCounts = usersData.reduce((acc, u) => {
            const role = u.role || 'user';
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {});

        setStats({
            total,
            activeToday,
            last24hActive,
            totalUsageToday,
            avgUsageActive,
            limitReached,
            roleCounts,
            topUsers
        });
    };

    const loadData = async () => {
        setLoading(true);
        try {
            // Evito orderBy para no depender de índices
            const snapshot = await db.collection('users').limit(300).get();

            const usersData = await Promise.all(snapshot.docs.map(async (doc) => {
                const data = doc.data() || {};
                const usageDoc = await doc.ref.collection('usage').doc(today).get();
                const todayUsage = usageDoc.exists ? (usageDoc.data()?.count || 0) : 0;

                const email = data.email || '';
                const role = data.role || (email === ADMIN_EMAIL ? 'admin' : 'user');

                const lastActiveDate = safeDate(data.lastActive);

                return {
                    uid: doc.id,
                    email,
                    role,
                    todayUsage,
                    lastActiveRaw: data.lastActive || null,
                    lastActiveDate,
                    lastActiveText: formatDateTime(lastActiveDate),
                    createdAtRaw: data.createdAt || null
                };
            }));

            // Orden por actividad (cliente)
            usersData.sort((a, b) => (b.lastActiveDate?.getTime() || 0) - (a.lastActiveDate?.getTime() || 0));

            setUsers(usersData);
            computeStats(usersData);
        } catch (e) {
            console.error('Error loading admin data:', e);
            alert('Error cargando datos de Firestore: ' + (e?.message || e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    });

    const resetTodayUsage = async (uid) => {
        try {
            const usageRef = db.collection('users').doc(uid).collection('usage').doc(today);
            await usageRef.set({ count: 0 }, { merge: true });
            await loadData();
        } catch (e) {
            alert('Error reseteando uso: ' + e.message);
        }
    };

    const setRole = async (uid, newRole) => {
        try {
            await db.collection('users').doc(uid).set({ role: newRole }, { merge: true });
            await loadData();
        } catch (e) {
            alert('Error actualizando rol: ' + e.message);
        }
    };

    const deleteUserDoc = async (uid, email) => {
        if (!confirm(`¿Eliminar el usuario en Firestore?

 ${email || uid}

(OJO: esto NO elimina la cuenta en Auth)`)) return;
        try {
            await db.collection('users').doc(uid).delete();
            await loadData();
        } catch (e) {
            alert('Error eliminando usuario: ' + e.message);
        }
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
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${accent} opacity-90 flex items-center justify-center text-slate-950 font-black`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">{label}</div>
                    <div className="text-2xl font-extrabold text-white leading-tight">{value}</div>
                    {subtext && <div className="mt-1 text-xs text-slate-400">{subtext}</div>}
                </div>
            </div>
        </div>
    );

    const TabBtn = ({ id, icon, children }) => {
        const active = selectedTab === id;
        return (
            <button
                onClick={() => setSelectedTab(id)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition flex items-center gap-2
                    ${active
                        ? 'bg-gradient-to-r from-cyan-300 to-violet-300 text-slate-950 border-white/20 shadow-lg'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'}`}
            >
                <span className="opacity-90">{icon}</span>
                {children}
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-6xl max-h-[90vh] rounded-3xl overflow-hidden border border-white/10 bg-slate-950/70 shadow-2xl flex flex-col">
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-red-400 to-amber-300 flex items-center justify-center text-slate-950 font-black">
                                <i data-lucide="shield" className="w-5 h-5"></i>
                            </div>
                            <div>
                                <h2 className="text-2xl font-extrabold text-white leading-tight">Panel de Administración</h2>
                                <p className="text-sm text-slate-400">Datos en vivo desde Firestore · {today}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadData}
                            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-bold flex items-center gap-2"
                            title="Recargar"
                        >
                            <i data-lucide="refresh-cw" className="w-4 h-4"></i>
                            Recargar
                        </button>

                        <button
                            onClick={onClose}
                            className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/30 text-red-200 text-sm font-bold flex items-center gap-2"
                            title="Cerrar"
                        >
                            <i data-lucide="x" className="w-4 h-4"></i>
                            Cerrar
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto custom-scrollbar p-6">
                    {/* Tabs */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        <TabBtn id="overview" icon={<i data-lucide="bar-chart-3" className="w-4 h-4"></i>}>Estadísticas</TabBtn>
                        <TabBtn id="users" icon={<i data-lucide="users" className="w-4 h-4"></i>}>Usuarios ({users.length})</TabBtn>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                            <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-cyan-300 animate-spin mb-4"></div>
                            <div className="text-sm font-bold tracking-wide">Cargando datos...</div>
                        </div>
                    ) : (
                        <>
                            {/* OVERVIEW */}
                            {selectedTab === 'overview' && stats && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <StatCard icon="👥" label="Total usuarios" value={stats.total} subtext="Documentos en users/*" />
                                        <StatCard icon="🔥" label="Activos hoy" value={stats.activeToday} subtext="Uso > 0 hoy" accent="from-amber-300 to-red-400" />
                                        <StatCard icon="📈" label="Uso total hoy" value={stats.totalUsageToday} subtext={`Media activos: ${stats.avgUsageActive.toFixed(2)}`} accent="from-emerald-300 to-cyan-300" />
                                        <StatCard icon="⏱️" label="Activos 24h" value={stats.last24hActive} subtext={`Límite alcanzado: ${stats.limitReached}`} accent="from-violet-300 to-fuchsia-300" />
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                        {/* Roles */}
                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="text-sm font-extrabold text-white flex items-center gap-2">
                                                    <i data-lucide="badge-check" className="w-4 h-4 text-cyan-300"></i>
                                                    Distribución de roles
                                                </div>
                                                <div className="text-xs text-slate-400">Campo users.role (si existe)</div>
                                            </div>

                                            <div className="space-y-2">
                                                {Object.entries(stats.roleCounts || {}).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
                                                    <div key={role} className="flex items-center justify-between text-sm">
                                                        <div className="text-slate-300 font-bold">{role}</div>
                                                        <div className="text-white font-extrabold">{count}</div>
                                                    </div>
                                                ))}
                                                {!Object.keys(stats.roleCounts || {}).length && (
                                                    <div className="text-sm text-slate-400">Sin datos de roles (se muestra 'user' por defecto).</div>
                                                )}
                                            </div>

                                            <div className="mt-4 text-xs text-slate-400">
                                                Consejo: puedes poner <span className="text-slate-200 font-bold">role: 'vip'</span> a un usuario para identificarlo aquí.
                                            </div>
                                        </div>

                                        {/* Top users */}
                                        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="text-sm font-extrabold text-white flex items-center gap-2">
                                                    <i data-lucide="trophy" className="w-4 h-4 text-amber-300"></i>
                                                    Top usuarios hoy
                                                </div>
                                                <button
                                                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold"
                                                    onClick={() => exportCSV(filteredUsers)}
                                                >
                                                    Exportar CSV
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {stats.topUsers.map((u) => (
                                                    <div key={u.uid} className="rounded-xl border border-white/10 bg-slate-900/40 p-4 flex items-center justify-between">
                                                        <div className="min-w-0">
                                                            <div className="text-white font-bold truncate">{u.email || '(sin email)'}</div>
                                                            <div className="text-xs text-slate-400 truncate">{u.uid}</div>
                                                            <div className="text-xs text-slate-400 mt-1">Último: {u.lastActiveText}</div>
                                                        </div>
                                                        <div className={`ml-4 shrink-0 px-3 py-1 rounded-lg text-xs font-extrabold border
                                                            ${(u.todayUsage || 0) >= DAILY_LIMIT
                                                                ? 'bg-red-500/15 text-red-200 border-red-500/30'
                                                                : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'}`}>
                                                            {u.todayUsage || 0} / {DAILY_LIMIT}
                                                        </div>
                                                    </div>
                                                ))}
                                                {!stats.topUsers.length && <div className="text-sm text-slate-400">No hay actividad hoy.</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* USERS */}
                            {selectedTab === 'users' && (
                                <div className="space-y-4">
                                    <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                                        <div className="flex-1">
                                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">
                                                Buscar por email o UID
                                            </label>
                                            <input
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Ej: usuario@gmail.com o uid..."
                                                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 outline-none focus:border-cyan-300/50"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-bold"
                                                onClick={() => exportCSV(filteredUsers)}
                                            >
                                                Exportar CSV (filtrado)
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/10 overflow-hidden">
                                        <div className="overflow-auto">
                                            <table className="min-w-[900px] w-full text-left border-collapse">
                                                <thead className="bg-slate-900/70">
                                                    <tr className="text-[11px] uppercase text-slate-400 tracking-wider">
                                                        <th className="p-4">Usuario</th>
                                                        <th className="p-4">UID</th>
                                                        <th className="p-4">Rol</th>
                                                        <th className="p-4">Uso hoy</th>
                                                        <th className="p-4">Última actividad</th>
                                                        <th className="p-4">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-slate-950/40">
                                                    {filteredUsers.map((u) => (
                                                        <tr key={u.uid} className="border-t border-white/5 hover:bg-white/5">
                                                            <td className="p-4">
                                                                <div className="font-bold text-white">{u.email || '(sin email)'}</div>
                                                            </td>
                                                            <td className="p-4 font-mono text-xs text-slate-400">{u.uid}</td>
                                                            <td className="p-4">
                                                                <span className={`px-2 py-1 rounded-lg text-xs font-extrabold border
                                                                    ${u.role === 'admin'
                                                                        ? 'bg-amber-500/15 text-amber-200 border-amber-500/30'
                                                                        : u.role === 'vip'
                                                                            ? 'bg-violet-500/15 text-violet-200 border-violet-500/30'
                                                                            : 'bg-slate-500/15 text-slate-200 border-slate-500/30'}`}>
                                                                    {u.role}
                                                                </span>
                                                            </td>
                                                            <td className="p-4">
                                                                <span className={`px-2 py-1 rounded-lg text-xs font-extrabold border
                                                                    ${(u.todayUsage || 0) >= DAILY_LIMIT
                                                                        ? 'bg-red-500/15 text-red-200 border-red-500/30'
                                                                        : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'}`}>
                                                                    {u.todayUsage || 0} / {DAILY_LIMIT}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-xs text-slate-400">{u.lastActiveText}</td>
                                                            <td className="p-4">
                                                                <div className="flex flex-wrap gap-2">
                                                                    <button
                                                                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold"
                                                                        onClick={() => resetTodayUsage(u.uid)}
                                                                    >
                                                                        Reset hoy
                                                                    </button>

                                                                    {u.role !== 'admin' && (
                                                                        <button
                                                                            className={`px-3 py-2 rounded-xl border text-xs font-bold
                                                                                ${u.role === 'vip'
                                                                                    ? 'bg-violet-500/10 hover:bg-violet-500/15 border-violet-500/30 text-violet-200'
                                                                                    : 'bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/30 text-emerald-200'}`}
                                                                            onClick={() => setRole(u.uid, u.role === 'vip' ? 'user' : 'vip')}
                                                                        >
                                                                            {u.role === 'vip' ? 'Quitar VIP' : 'Hacer VIP'}
                                                                        </button>
                                                                    )}

                                                                    {u.uid !== auth.currentUser?.uid && (
                                                                        <button
                                                                            className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/30 text-red-200 text-xs font-bold"
                                                                            onClick={() => deleteUserDoc(u.uid, u.email)}
                                                                        >
                                                                            Eliminar doc
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}

                                                    {!filteredUsers.length && (
                                                        <tr>
                                                            <td className="p-6 text-sm text-slate-400" colSpan="6">
                                                                No hay resultados.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-400">
                                        Nota: "Eliminar doc" borra el documento en Firestore, pero no elimina la cuenta de Firebase Auth (eso requiere backend/admin SDK).
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const App = () => {
    // Auth State
    const [user, setUser] = useState(null);
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [adminPanelOpen, setAdminPanelOpen] = useState(false);
    const [dailyUsage, setDailyUsage] = useState(0);

    const [uploadedFile, setUploadedFile] = useState(null);
    const [originalImage, setOriginalImage] = useState(null);

    const [currentSettings, setCurrentSettings] = useState(INITIAL_SETTINGS);
    const [history, setHistory] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiMessage, setAiMessage] = useState("");
    const [palette, setPalette] = useState([]);
    const [memeData, setMemeData] = useState(null);

    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const [selectedStyleId, setSelectedStyleId] = useState("");
    const [selectedStyleDescription, setSelectedStyleDescription] = useState("");
    const [editablePrompt, setEditablePrompt] = useState("");

    const [copySuccess, setCopySuccess] = useState(false);

    const [previousImageBeforeEdit, setPreviousImageBeforeEdit] = useState(null);
    const [hasOverlayFromHistory, setHasOverlayFromHistory] = useState(false);

    // Estados para los tooltips
    const [hoveredSlider, setHoveredSlider] = useState(null);
    const [hoveredHistoryItem, setHoveredHistoryItem] = useState(null);

    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setAuthModalOpen(true);
            } else {
                setAuthModalOpen(false);
                // Registrar usuario en DB si no existe
                const userRef = db.collection('users').doc(currentUser.uid);
                await userRef.set({
                    email: currentUser.email,
                    lastActive: new Date()
                }, { merge: true });

                // Obtener uso diario
                const today = getTodayDateString();
                const usageDoc = await userRef.collection('usage').doc(today).get();
                setDailyUsage(usageDoc.exists ? usageDoc.data().count : 0);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    });

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                setUploadedFile(event.target.result);
                setOriginalImage(event.target.result);
                setCurrentSettings(INITIAL_SETTINGS);
                setAiMessage("");
                setPalette([]);
                setMemeData(null);
                setPreviousImageBeforeEdit(null);
                setHasOverlayFromHistory(false);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    // Reemplazar completamente la función renderImage existente
    const renderImage = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !originalImage) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const img = new Image();
        img.src = originalImage;

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.translate((canvas.width / 2) + currentSettings.panX, (canvas.height / 2) + currentSettings.panY);
            ctx.rotate((currentSettings.rotation * Math.PI) / 180);
            const scale = currentSettings.scale / 100;
            ctx.scale(scale, scale);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);

            const brightnessVal = currentSettings.brightness + (currentSettings.exposure * 10);

            ctx.filter = `
                brightness(${brightnessVal}%) 
                contrast(${currentSettings.contrast}%) 
                saturate(${currentSettings.saturation}%) 
                hue-rotate(${currentSettings.hue}deg) 
                blur(${currentSettings.blur}px)
            `;
            ctx.drawImage(img, 0, 0);
            ctx.restore();

            // Aplicar efectos locales
            if (currentSettings.temperature !== 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'overlay';
                ctx.fillStyle = currentSettings.temperature > 0
                    ? `rgba(255,140,0,${Math.abs(currentSettings.temperature) / 250})`
                    : `rgba(0,100,255,${Math.abs(currentSettings.temperature) / 250})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.restore();
            }

            if (currentSettings.vignette > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'multiply';
                const maxDim = Math.max(canvas.width, canvas.height);
                const gradient = ctx.createRadialGradient(
                    canvas.width / 2, canvas.height / 2, canvas.width * 0.3,
                    canvas.width / 2, canvas.height / 2, maxDim * 0.8
                );
                gradient.addColorStop(0, "rgba(0,0,0,0)");
                gradient.addColorStop(1, `rgba(0,0,0,${currentSettings.vignette / 100})`);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.restore();
            }

            // Nuevas funcionalidades locales
            if (currentSettings.clarity !== 0) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const factor = currentSettings.clarity / 100;

                for (let i = 0; i < data.length; i += 4) {
                    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    const contrast = (gray - 128) * factor;

                    data[i] = Math.min(255, Math.max(0, data[i] + contrast));
                    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + contrast));
                    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + contrast));
                }

                ctx.putImageData(imageData, 0, 0);
            }

            if (currentSettings.vibrance !== 0) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const amount = currentSettings.vibrance / 100;

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    const max = Math.max(r, g, b);
                    const avg = (r + g + b) / 3;
                    const amt = ((Math.abs(max - avg) * 2 / 255) * amount) / 100;

                    data[i] = Math.min(255, Math.max(0, r + (max - r) * amt));
                    data[i + 1] = Math.min(255, Math.max(0, g + (max - g) * amt));
                    data[i + 2] = Math.min(255, Math.max(0, b + (max - b) * amt));
                }

                ctx.putImageData(imageData, 0, 0);
            }

            if (currentSettings.noiseReduction > 0) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                applyNoiseReduction(imageData, currentSettings.noiseReduction / 100);
                ctx.putImageData(imageData, 0, 0);
            }

            if (currentSettings.sharpening > 0) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                applySharpening(imageData, currentSettings.sharpening / 100);
                ctx.putImageData(imageData, 0, 0);
            }

            if (currentSettings.filmGrain > 0) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const intensity = currentSettings.filmGrain * 2.55;

                for (let i = 0; i < data.length; i += 4) {
                    const noise = (Math.random() - 0.5) * intensity;
                    data[i] = Math.min(255, Math.max(0, data[i] + noise));
                    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
                    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
                }

                ctx.putImageData(imageData, 0, 0);
            }

            if (currentSettings.whiteBalance.temperature !== 0 || currentSettings.whiteBalance.tint !== 0) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                const temp = currentSettings.whiteBalance.temperature / 100;
                const tint = currentSettings.whiteBalance.tint / 100;

                for (let i = 0; i < data.length; i += 4) {
                    // Ajuste de temperatura
                    data[i] = Math.min(255, Math.max(0, data[i] + temp * 30));
                    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] - temp * 30));

                    // Ajuste de tint
                    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + tint * 20));
                }

                ctx.putImageData(imageData, 0, 0);
            }

            if (currentSettings.midtoneContrast !== 0) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const factor = (259 * (currentSettings.midtoneContrast + 255)) / (255 * (259 - currentSettings.midtoneContrast));

                for (let i = 0; i < data.length; i += 4) {
                    // Aplicar solo a medios tonos (valores entre 64 y 192)
                    for (let c = 0; c < 3; c++) {
                        const value = data[i + c];
                        if (value > 64 && value < 192) {
                            data[i + c] = Math.min(255, Math.max(0, factor * (value - 128) + 128));
                        }
                    }
                }

                ctx.putImageData(imageData, 0, 0);
            }

            if (currentSettings.hdrEffect > 0) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const strength = currentSettings.hdrEffect / 100;

                for (let i = 0; i < data.length; i += 4) {
                    // Mapeo tonal HDR
                    for (let c = 0; c < 3; c++) {
                        let value = data[i + c] / 255;

                        // Curva tonal HDR
                        value = Math.pow(value, 1 / (1 + strength * 2));
                        value = value / (value + Math.pow(0.5, 1 / (1 + strength)));

                        data[i + c] = Math.min(255, Math.max(0, value * 255));
                    }
                }

                ctx.putImageData(imageData, 0, 0);
            }

            if (currentSettings.ortonEffect > 0) {
                ctx.save();

                // Crear versión desenfocada
                const blurredCanvas = document.createElement('canvas');
                blurredCanvas.width = canvas.width;
                blurredCanvas.height = canvas.height;
                const blurredCtx = blurredCanvas.getContext('2d');
                blurredCtx.filter = `blur(${20 + currentSettings.ortonEffect / 5}px)`;
                blurredCtx.drawImage(canvas, 0, 0);

                // Combinar con la original
                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = currentSettings.ortonEffect / 200;
                ctx.drawImage(blurredCanvas, 0, 0);

                ctx.restore();
            }

            if (currentSettings.focalBlur > 0) {
                ctx.save();

                // Crear máscara radial para el desenfoque
                const gradient = ctx.createRadialGradient(
                    canvas.width * currentSettings.focalPoint.x / 100,
                    canvas.height * currentSettings.focalPoint.y / 100,
                    0,
                    canvas.width * currentSettings.focalPoint.x / 100,
                    canvas.height * currentSettings.focalPoint.y / 100,
                    Math.max(canvas.width, canvas.height) * 0.7
                );
                gradient.addColorStop(0, "rgba(0,0,0,0)");
                gradient.addColorStop(0.3, "rgba(0,0,0,0)");
                gradient.addColorStop(1, "rgba(0,0,0,1)");

                // Guardar la imagen original
                const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // Aplicar desenfoque a toda la imagen
                ctx.filter = `blur(${currentSettings.focalBlur}px)`;
                ctx.drawImage(canvas, 0, 0);

                // Recuperar la imagen original
                const originalCanvas = document.createElement('canvas');
                originalCanvas.width = canvas.width;
                originalCanvas.height = canvas.height;
                const originalCtx = originalCanvas.getContext('2d');
                originalCtx.putImageData(originalImageData, 0, 0);

                // Aplicar máscara para mantener el área focal nítida
                ctx.globalCompositeOperation = 'destination-in';
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Combinar con la imagen original
                ctx.globalCompositeOperation = 'destination-over';
                ctx.drawImage(originalCanvas, 0, 0);

                ctx.restore();
            }

            ctx.filter = 'none';

            if (memeData) {
                ctx.save();
                const fontSize = Math.max(20, canvas.height * 0.1);
                ctx.font = `900 ${fontSize}px Impact, sans-serif`;
                ctx.fillStyle = "white";
                ctx.strokeStyle = "black";
                ctx.lineWidth = fontSize * 0.08;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";

                const drawMemeText = (text, y, baseline) => {
                    if (!text) return;
                    ctx.textBaseline = baseline;
                    const x = canvas.width / 2;
                    const maxWidth = canvas.width * 0.95;

                    const words = text.toUpperCase().split(' ');
                    let line = '';
                    let lines = [];

                    for (let n = 0; n < words.length; n++) {
                        const testLine = line + words[n] + ' ';
                        const metrics = ctx.measureText(testLine);
                        const testWidth = metrics.width;
                        if (testWidth > maxWidth && n > 0) {
                            lines.push(line);
                            line = words[n] + ' ';
                        } else {
                            line = testLine;
                        }
                    }
                    lines.push(line);

                    let currentY = y;
                    if (baseline === "bottom") {
                        currentY = y - ((lines.length - 1) * (fontSize * 1.1));
                    }

                    for (let i = 0; i < lines.length; i++) {
                        ctx.strokeText(lines[i], x, currentY);
                        ctx.fillText(lines[i], x, currentY);
                        currentY += fontSize * 1.1;
                    }
                };

                if (memeData.top) drawMemeText(memeData.top, fontSize * 0.2, "top");
                if (memeData.bottom) drawMemeText(memeData.bottom, canvas.height - (fontSize * 0.4), "bottom");
                ctx.restore();
            }
        };
    }, [originalImage, currentSettings, memeData]);

    useEffect(() => { renderImage(); }, [renderImage]);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        dragStart.current = { x: e.clientX, y: e.clientY };
        setCurrentSettings(prev => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }));
    };
    const handleMouseUp = () => setIsDragging(false);

    const saveToHistory = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;

        const savedImage = canvas.toDataURL('image/jpeg', 0.9);
        const thumbUrl = canvas.toDataURL('image/jpeg', 0.5);

        // Generar descripción de efectos aplicados
        const effectsDescription = getEffectsDescription(currentSettings);

        const newHistoryItem = {
            id: Date.now(),
            thumbnail: thumbUrl,
            originalSource: savedImage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            settings: { ...currentSettings }, // Guardar una copia de los ajustes actuales
            effectsDescription: effectsDescription // Guardar la descripción de efectos
        };
        setHistory(prev => [newHistoryItem, ...prev]);

        if (uploadedFile) setOriginalImage(uploadedFile);
        setCurrentSettings(INITIAL_SETTINGS);
        setMemeData(null);
        setAiMessage("¡Guardado! Lienzo restaurado a la imagen anterior.");
        setPreviousImageBeforeEdit(null);
        setHasOverlayFromHistory(false);

        setTimeout(() => setAiMessage(""), 2000);
    };

    const restoreFromHistory = (item) => {
        if (!originalImage) return;
        setPreviousImageBeforeEdit(originalImage);
        setOriginalImage(item.originalSource);
        setCurrentSettings(item.settings || INITIAL_SETTINGS);
        setMemeData(null);
        setHasOverlayFromHistory(true);
    };

    const handleDownloadHistory = (item) => {
        const link = document.createElement('a');
        link.download = `historial-${item.id}.jpg`;
        link.href = item.originalSource;
        link.click();
    };

    const handleDeleteHistory = (id) => {
        setHistory(prev => prev.filter(item => item.id !== id));
    };

    const handleDeleteCurrentImage = () => {
        setOriginalImage(null);
        setUploadedFile(null);
        setCurrentSettings(INITIAL_SETTINGS);
        setMemeData(null);
        setPalette([]);
        setAiMessage("");
        setPreviousImageBeforeEdit(null);
        setHasOverlayFromHistory(false);
    };

    const handleCancelOverlayEdit = () => {
        if (!previousImageBeforeEdit) return;
        setOriginalImage(previousImageBeforeEdit);
        setPreviousImageBeforeEdit(null);
        setHasOverlayFromHistory(false);
        setCurrentSettings(INITIAL_SETTINGS);
        setMemeData(null);
    };

    // --- WRAPPER PARA LIMITAR USO ---
    const executeWithLimit = async (callback) => {
        if (!user) {
            setAuthModalOpen(true);
            return;
        }
        setIsProcessing(true);
        try {
            const { allowed, count } = await checkAndIncrementDailyUsage(user.uid);
            if (allowed) {
                setDailyUsage(count);
                await callback();
            }
        } catch (error) {
            alert(error.message);
            setAiMessage(error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAiEnhance = () => {
        executeWithLimit(() => callGeminiAPI(
            "image",
            "Actúa como un retocador fotográfico profesional. Mejora sutilmente esta imagen: equilibra la exposición, corrige el balance de blancos, reduce el ruido digital y mejora la nitidez. Mantén el realismo."
        ));
    };

    const handleAiAnalysis = () => {
        executeWithLimit(() => callGeminiAPI(
            "text",
            "Analiza esta imagen como un fotógrafo profesional. 1) Describe brevemente el sujeto y la composición. 2) Dame 3 consejos técnicos concisos para mejorarla editando la luz o el color."
        ));
    };

    const handleAiStyle = (styleText) => {
        const stylePrompt = `
Eres un motor de TRANSFORMACIÓN DE ESTILO de imagen a imagen muy avanzado.
Debes rehacer COMPLETAMENTE la imagen que te doy aplicando el siguiente estilo visual, no solo cambiando brillo o color.

ESTILO APLICAR (descripción detallada):
 ${styleText}

REQUISITOS ESTRICTOS:
- Mantén la composición básica y la posición de los personajes y elementos principales.
- Reinterpreta TODO (personajes, fondo, colores, texturas, líneas) para que el resultado se vea CLARAMENTE en ese estilo.
- NO te limites a filtros de color, contraste o desenfoque. Cambia texturas, materiales, tipos de líneas, sombreado y acabado general.
- El resultado debe parecer una obra terminada en ese estilo.

Genera una nueva versión de la imagen en ese estilo.
        `;
        executeWithLimit(() => callGeminiAPI("image", stylePrompt));
    };

    const handleAiMeme = () => {
        setMemeData(null);
        const systemPrompt = `
Analiza esta imagen y crea un meme divertido y viral. 
Devuelve ÚNICAMENTE un objeto JSON:
{"top": "TEXTO SUPERIOR CORTO", "bottom": "TEXTO INFERIOR CORTO"}
        `;
        executeWithLimit(() => callGeminiAPI("json_meme", systemPrompt));
    };

    const handleAiExpand = (ratio) => {
        const prompt = `Adjust the aspect ratio of this image to ${ratio}. If there are new empty areas created by this format change, generate new content that fills them seamlessly, maintaining the style, lighting, and context of the original image (Outpainting). The result should look like a complete, natural image.`;
        executeWithLimit(() => callGeminiAPI("image", prompt, { aspectRatio: ratio }));
    };

    const handleAiSocial = () => {
        executeWithLimit(() => callGeminiAPI("text", "Genera: 1) Título para Instagram. 2) 5 hashtags relevantes."));
    };

    const handleAiPalette = () => {
        setPalette([]);
        executeWithLimit(() => callGeminiAPI(
            "json_palette",
            "Analiza los píxeles de la imagen. Simula un algoritmo de clustering (K-Means con K=5) para identificar los 5 colores más representativos. Responde SOLO con un array JSON de 5 códigos HEX."
        ));
    };

    // Reemplazar completamente la función callGeminiAPI existente
    const callGeminiAPI = async (mode, promptText, options = {}) => {
        if (!originalImage) return;
        setAiMessage(mode === "image" ? "Generando imagen..." : "Gemini pensando...");

        try {
            const currentImageData = canvasRef.current
                .toDataURL('image/jpeg', 0.7)
                .split(',')[1];

            const modalities = mode === "image" ? ["IMAGE"] : ["TEXT"];
            const aspectRatio = options.aspectRatio || "1:1";

            let response;
            try {
                response = await fetch('proxy.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        task: 'generateImage',
                        provider: 'gemini',
                        model: 'gemini-3-pro-image-preview', // Especificar el modelo
                        prompt: promptText,
                        images: [{
                            mimeType: 'image/jpeg',
                            data: currentImageData
                        }],
                        modalities,
                        aspectRatio,
                        generationConfig: {
                            temperature: mode === "image" ? 0.6 : 0,
                            topP: 1,
                            topK: 1
                        }
                    })
                });
            } catch {
                throw new Error("Error de red: no se pudo conectar con el servidor PHP.");
            }

            const contentType = response.headers.get("content-type");
            let data;
            if (contentType && contentType.indexOf("application/json") !== -1) {
                data = await response.json();
            } else {
                throw new Error("El servidor devolvió una respuesta no válida.");
            }

            if (data.error) throw new Error(data.error);

            if (mode === "image" && data.image) {
                const newImageSrc = `data:${data.mimeType};base64,${data.image}`;
                setOriginalImage(newImageSrc);
                setCurrentSettings(prev => ({ ...INITIAL_SETTINGS, scale: prev.scale, panX: prev.panX, panY: prev.panY }));
                setMemeData(null);
                setAiMessage("Imagen transformada.");
                setPreviousImageBeforeEdit(null);
                setHasOverlayFromHistory(false);
            } else if (mode === "text" && data.text) {
                setAiMessage(data.text);
            } else if (mode === "json_palette" && data.text) {
                try {
                    let cleanText = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const regex = /(\[[\s\S]*?\])/;
                    const match = cleanText.match(regex);
                    let arrayString;

                    if (match && match[1]) {
                        arrayString = match[1].trim();
                    } else {
                        const start = cleanText.indexOf('[');
                        const end = cleanText.lastIndexOf(']');
                        if (start !== -1 && end !== -1 && end > start) {
                            arrayString = cleanText.substring(start, end + 1).trim();
                        } else {
                            throw new Error("No se pudo aislar la estructura de la paleta.");
                        }
                    }

                    arrayString = arrayString.replace(/'/g, '"');
                    const colors = JSON.parse(arrayString);

                    const isValidPalette = Array.isArray(colors) && colors.every(c =>
                        typeof c === 'string' && c.match(/^#([0-9a-fA-F]{3}){1,2}$/)
                    );

                    if (isValidPalette) {
                        setPalette(colors);
                        setAiMessage("¡Paleta de colores extraída! Haz clic para copiar.");
                    } else {
                        throw new Error("El contenido no es una lista de códigos HEX válidos.");
                    }
                } catch (e) {
                    console.error(e);
                    setAiMessage("No se pudo extraer la paleta: formato incorrecto.");
                }
            } else if (mode === "json_meme" && data.text) {
                try {
                    let cleanJson = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const meme = JSON.parse(cleanJson);
                    setMemeData(meme);
                    setAiMessage("¡Meme generado! Puedes editar el texto abajo.");
                } catch (e) {
                    console.error(e);
                    setAiMessage("Error al generar el meme.");
                }
            }

        } catch (error) {
            console.error("Error en IA:", error);
            setAiMessage("Error: " + error.message);
        } finally {
            if (!options.skipLoaderOff) setIsProcessing(false);

            if (mode === "image" || mode === "json_meme") {
                setTimeout(() => setAiMessage(""), 5000);
            }
        }
    };

    // Pegar después de la función callGeminiAPI
    // Nuevas funciones para efectos con Gemini
    const handleAiFocalBlur = () => {
        const prompt = "Aplica un efecto de enfoque selectivo a la imagen, desenfocando el fondo mientras mantienes el sujeto principal nítido. Crea una separación clara entre el primer plano y el fondo para dar profundidad.";
        executeWithLimit(() => callGeminiAPI("image", prompt));
    };

    const handleAiDepthOfField = () => {
        const prompt = "Aplica un efecto de campo profundo profesional a la imagen, similar al de una cámara DSLR. El sujeto principal debe estar perfectamente enfocado mientras el fondo tiene un bokeh suave y atractivo.";
        executeWithLimit(() => callGeminiAPI("image", prompt));
    };

    const handleAiColorGrading = () => {
        const prompt = "Aplica una gradación de color cinematográfica profesional a la imagen. Mejora los colores para crear un mood específico, con tonos cohesivos y una paleta de colores refinada que se vea profesional.";
        executeWithLimit(() => callGeminiAPI("image", prompt));
    };

    const handleAiSkinRetouch = () => {
        const prompt = "Retoca la piel de las personas en la imagen de forma natural. Elimina imperfecciones menores, uniformiza el tono de piel y mejora la textura sin que se vea artificial o excesivamente editado.";
        executeWithLimit(() => callGeminiAPI("image", prompt));
    };

    const handleAiBackgroundRemoval = () => {
        const prompt = "Elimina el fondo de la imagen y reemplázalo con un fondo neutro o transparente. Mantén los bordes del sujeto principal limpios y precisos.";
        executeWithLimit(() => callGeminiAPI("image", prompt));
    };

    const handleAiLowLightEnhancement = () => {
        const prompt = "Mejora una imagen tomada en condiciones de poca luz. Reduce el ruido, mejora la visibilidad en las áreas oscuras y equilibra la exposición sin sobreexponer las áreas iluminadas.";
        executeWithLimit(() => callGeminiAPI("image", prompt));
    };

    const handleAiColorCorrection = () => {
        const prompt = "Corrige el balance de blancos y los colores de la imagen. Ajusta la temperatura y el tinte para que los colores se vean naturales y precisos.";
        executeWithLimit(() => callGeminiAPI("image", prompt));
    };

    const handleAiLensCorrection = () => {
        const prompt = "Corrige distorsiones de lente en la imagen, como distorsión de barril o cojín. Endereza las líneas que deberían ser rectas y corrige la perspectiva.";
        executeWithLimit(() => callGeminiAPI("image", prompt));
    };

    const handleAiArtisticFilter = () => {
        const prompt = "Aplica un filtro artístico a la imagen que la transforme en una obra de arte digital. Mantén el sujeto reconocible pero dale un estilo artístico único.";
        executeWithLimit(() => callGeminiAPI("image", prompt));
    };

    const handleAiPortraitMode = () => {
        const prompt = "Transforma la imagen en un retrato profesional con iluminación favorecedora. Mejora la iluminación del rostro, suaviza la piel de forma natural y crea un ambiente agradable.";
        executeWithLimit(() => callGeminiAPI("image", prompt));
    };

    const updateSetting = (key, value) => {
        setCurrentSettings(prev => ({ ...prev, [key]: parseFloat(value) }));
    };

    const copyColor = (color) => {
        navigator.clipboard.writeText(color);
        setAiMessage(`Color ${color} copiado.`);
        setTimeout(() => setAiMessage(""), 2000);
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-300 font-sans">
            {/* 🔥 Overlay de carga con fondo animado */}
            {isProcessing && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                    <div className="relative w-20 h-20">
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin shadow-lg shadow-blue-500/50"></div>
                        <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-500 animate-spin animation-delay-200 shadow-md shadow-purple-500/50"></div>
                    </div>
                    <p className="mt-6 text-white text-xl font-semibold tracking-wide animate-pulse">Generando con IA...</p>
                </div>
            )}

            {/* MODAL DE LOGIN */}
            {!user && authModalOpen && <AuthModal />}

            {/* PANEL DE ADMIN */}
            {adminPanelOpen && <AdminPanel onClose={() => setAdminPanelOpen(false)} />}

            <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-2 text-blue-400 select-none">
                    <i data-lucide="aperture" className="w-6 h-6"></i>
                    <h1 className="font-bold text-lg text-white tracking-tight">
                        Gemini<span className="font-light text-blue-200">Editor</span>
                    </h1>
                </div>

                <div className="flex gap-3 items-center">
                    {/* INFO DE USUARIO Y ADMIN */}
                    {user && (
                        <div className="flex items-center gap-4 mr-2">
                            {user.email === ADMIN_EMAIL && (
                                <button
                                    onClick={() => setAdminPanelOpen(true)}
                                    className="px-3 py-1 bg-red-900/50 border border-red-500 text-red-300 text-xs font-bold rounded hover:bg-red-900 transition flex items-center gap-2"
                                >
                                    <i data-lucide="shield" className="w-3 h-3"></i>
                                    ADMIN
                                </button>
                            )}
                            <div className="text-right">
                                <p className="text-xs text-white font-medium">{user.email}</p>
                                <p className="text-[10px] text-slate-400">
                                    Créditos hoy: <span className={dailyUsage >= DAILY_LIMIT ? "text-red-400 font-bold" : "text-green-400 font-bold"}>
                                        {dailyUsage} / {DAILY_LIMIT}
                                    </span>
                                </p>
                            </div>
                            <button
                                onClick={() => auth.signOut()}
                                className="p-1.5 hover:bg-slate-700 rounded text-slate-400"
                                title="Cerrar Sesión"
                            >
                                <i data-lucide="log-out" className="w-4 h-4"></i>
                            </button>
                        </div>
                    )}

                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current.click()}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm font-medium transition flex items-center gap-2 border border-slate-600"
                    >
                        <i data-lucide="upload" className="w-4 h-4"></i>
                        <span className="hidden sm:inline">Nueva Foto</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {/* PANEL IZQUIERDO */}
                <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-10">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                        {/* ASISTENTE GEMINI */}
                        <div className="p-4 bg-gradient-to-br from-indigo-900/50 to-slate-900 rounded-xl border border-indigo-500/40 shadow-lg relative overflow-hidden">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                                    <i data-lucide="sparkles" className="w-4 h-4 text-indigo-400"></i>
                                    Asistente Gemini
                                </h3>
                            </div>

                            {/* ESTILOS (DESPLEGABLE + APLICAR DEBAJO) */}
                            <div className="mb-4">
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">
                                    Estilos visuales (desplegable)
                                </label>
                                <select
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                                    value={selectedStyleId}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSelectedStyleId(value);
                                        const style = STYLE_PRESETS.find(s => s.id === value);
                                        setSelectedStyleDescription(style ? style.prompt : "");
                                        setEditablePrompt(style ? style.prompt : "");
                                    }}
                                    disabled={!originalImage || isProcessing}
                                >
                                    <option value="">Selecciona un estilo...</option>
                                    {STYLE_PRESETS.map(style => (
                                        <option key={style.id} value={style.id}>
                                            {style.label}
                                        </option>
                                    ))}
                                </select>

                                {/* Prompt editable */}
                                {selectedStyleDescription && (
                                    <div className="mt-2">
                                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">
                                            Prompt del estilo (editable)
                                        </label>
                                        <textarea
                                            value={editablePrompt}
                                            onChange={(e) => setEditablePrompt(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none resize-none"
                                            rows={3}
                                            placeholder="Edita el prompt aquí..."
                                        />
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        if (editablePrompt) handleAiStyle(editablePrompt);
                                    }}
                                    disabled={!originalImage || isProcessing || !editablePrompt}
                                    className="mt-2 w-full py-1.5 bg-indigo-700 hover:bg-indigo-600 text-[11px] rounded text-white border border-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                    <i data-lucide="wand-2" className="w-3 h-3"></i>
                                    Aplicar estilo con prompt personalizado
                                </button>
                            </div>

                            {/* ACCIONES RÁPIDAS */}
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <button
                                    onClick={handleAiEnhance}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-slate-700 hover:bg-slate-600 text-[10px] rounded text-slate-200 border border-slate-600 transition flex justify-center items-center gap-1"
                                >
                                    <i data-lucide="image-plus" className="w-3 h-3"></i> Auto-Mejora
                                </button>
                                <button
                                    onClick={handleAiAnalysis}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-slate-700 hover:bg-slate-600 text-[10px] rounded text-slate-200 border border-slate-600 transition flex justify-center items-center gap-1"
                                >
                                    <i data-lucide="eye" className="w-3 h-3"></i> Analizar
                                </button>
                                <button
                                    onClick={handleAiSocial}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-slate-700 hover:bg-slate-600 text-[10px] rounded text-slate-200 border border-slate-600 transition flex justify-center items-center gap-1"
                                >
                                    <i data-lucide="share-2" className="w-3 h-3"></i> Social Post
                                </button>
                                <button
                                    onClick={handleAiPalette}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-slate-700 hover:bg-slate-600 text-[10px] rounded text-slate-200 border border-slate-600 transition flex justify-center items-center gap-1"
                                >
                                    <i data-lucide="palette" className="w-3 h-3"></i> Paleta Color
                                </button>
                                <button
                                    onClick={handleAiMeme}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-amber-700 hover:bg-amber-600 text-[10px] rounded text-amber-100 border border-amber-600 transition flex justify-center items-center gap-1 font-bold shadow-sm"
                                >
                                    <i data-lucide="smile" className="w-3 h-3"></i> Crear Meme
                                </button>
                                <button
                                    onClick={handleAiFocalBlur}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-indigo-700 hover:bg-indigo-600 text-[10px] rounded text-indigo-100 border border-indigo-600 transition flex justify-center items-center gap-1 font-bold shadow-sm"
                                >
                                    <i data-lucide="aperture" className="w-3 h-3"></i> Enfoque Selectivo
                                </button>
                                <button
                                    onClick={handleAiDepthOfField}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-indigo-700 hover:bg-indigo-600 text-[10px] rounded text-indigo-100 border border-indigo-600 transition flex justify-center items-center gap-1 font-bold shadow-sm"
                                >
                                    <i data-lucide="camera" className="w-3 h-3"></i> Campo Profundo
                                </button>
                                <button
                                    onClick={handleAiColorGrading}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-indigo-700 hover:bg-indigo-600 text-[10px] rounded text-indigo-100 border border-indigo-600 transition flex justify-center items-center gap-1 font-bold shadow-sm"
                                >
                                    <i data-lucide="sliders" className="w-3 h-3"></i> Gradación Color
                                </button>
                                <button
                                    onClick={handleAiSkinRetouch}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-indigo-700 hover:bg-indigo-600 text-[10px] rounded text-indigo-100 border border-indigo-600 transition flex justify-center items-center gap-1 font-bold shadow-sm"
                                >
                                    <i data-lucide="user" className="w-3 h-3"></i> Retoque Piel
                                </button>
                                <button
                                    onClick={handleAiBackgroundRemoval}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-indigo-700 hover:bg-indigo-600 text-[10px] rounded text-indigo-100 border border-indigo-600 transition flex justify-center items-center gap-1 font-bold shadow-sm"
                                >
                                    <i data-lucide="scissors" className="w-3 h-3"></i> Eliminar Fondo
                                </button>
                                <button
                                    onClick={handleAiLowLightEnhancement}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-indigo-700 hover:bg-indigo-600 text-[10px] rounded text-indigo-100 border border-indigo-600 transition flex justify-center items-center gap-1 font-bold shadow-sm"
                                >
                                    <i data-lucide="moon" className="w-3 h-3"></i> Mejora Baja Luz
                                </button>
                                <button
                                    onClick={handleAiColorCorrection}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-indigo-700 hover:bg-indigo-600 text-[10px] rounded text-indigo-100 border border-indigo-600 transition flex justify-center items-center gap-1 font-bold shadow-sm"
                                >
                                    <i data-lucide="droplet" className="w-3 h-3"></i> Corrección Color
                                </button>
                                <button
                                    onClick={handleAiLensCorrection}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-indigo-700 hover:bg-indigo-600 text-[10px] rounded text-indigo-100 border border-indigo-600 transition flex justify-center items-center gap-1 font-bold shadow-sm"
                                >
                                    <i data-lucide="maximize" className="w-3 h-3"></i> Corrección Lente
                                </button>
                                <button
                                    onClick={handleAiArtisticFilter}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-indigo-700 hover:bg-indigo-600 text-[10px] rounded text-indigo-100 border border-indigo-600 transition flex justify-center items-center gap-1 font-bold shadow-sm"
                                >
                                    <i data-lucide="brush" className="w-3 h-3"></i> Filtro Artístico
                                </button>
                                <button
                                    onClick={handleAiPortraitMode}
                                    disabled={!originalImage || isProcessing}
                                    className="py-1.5 bg-indigo-700 hover:bg-indigo-600 text-[10px] rounded text-indigo-100 border border-indigo-600 transition flex justify-center items-center gap-1 font-bold shadow-sm"
                                >
                                    <i data-lucide="user-check" className="w-3 h-3"></i> Modo Retrato
                                </button>
                            </div>

                            {/* EXPANSIÓN AR */}
                            <div className="mb-4">
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">
                                    Expansión creativa (AR)
                                </label>
                                <div className="grid grid-cols-4 gap-1">
                                    <button onClick={() => handleAiExpand("1:1")} disabled={!originalImage || isProcessing} className="py-1 bg-slate-800 hover:bg-indigo-600 text-[9px] rounded text-slate-300 border border-slate-700 transition">1:1</button>
                                    <button onClick={() => handleAiExpand("9:16")} disabled={!originalImage || isProcessing} className="py-1 bg-slate-800 hover:bg-indigo-600 text-[9px] rounded text-slate-300 border border-slate-700 transition">9:16</button>
                                    <button onClick={() => handleAiExpand("16:9")} disabled={!originalImage || isProcessing} className="py-1 bg-slate-800 hover:bg-indigo-600 text-[9px] rounded text-slate-300 border border-slate-700 transition">16:9</button>
                                    <button onClick={() => handleAiExpand("4:3")} disabled={!originalImage || isProcessing} className="py-1 bg-slate-800 hover:bg-indigo-600 text-[9px] rounded text-slate-300 border border-slate-700 transition">4:3</button>
                                    <button onClick={() => handleAiExpand("21:9")} disabled={!originalImage || isProcessing} className="py-1 bg-slate-800 hover:bg-indigo-600 text-[9px] rounded text-slate-300 border border-slate-700 transition font-bold">21:9</button>
                                    <button onClick={() => handleAiExpand("2:3")} disabled={!originalImage || isProcessing} className="py-1 bg-slate-800 hover:bg-indigo-600 text-[9px] rounded text-slate-300 border border-slate-700 transition">2:3</button>
                                    <button onClick={() => handleAiExpand("3:2")} disabled={!originalImage || isProcessing} className="py-1 bg-slate-800 hover:bg-indigo-600 text-[9px] rounded text-slate-300 border border-slate-700 transition">3:2</button>
                                </div>
                            </div>

                            {/* PALETA */}
                            {palette.length > 0 && (
                                <div
                                    className="flex h-6 w-full rounded overflow-hidden mb-3 border border-slate-600 cursor-pointer"
                                    title="Clic para copiar el código HEX"
                                >
                                    {palette.map((color, i) => (
                                        <div
                                            key={i}
                                            onClick={() => copyColor(color)}
                                            className="flex-1 h-full hover:opacity-80 transition-opacity"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* MENSAJE IA */}
                            {aiMessage && (
                                <div className="mt-3 relative group">
                                    <div className="text-[10px] font-mono p-3 bg-black/40 border border-indigo-500/20 rounded-lg text-indigo-200 break-words max-h-64 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                                        {aiMessage}
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(aiMessage);
                                            setCopySuccess(true);
                                            setTimeout(() => setCopySuccess(false), 2000);
                                        }}
                                        className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title="Copiar texto"
                                    >
                                        {copySuccess
                                            ? <i data-lucide="check" className="w-3 h-3 text-green-400"></i>
                                            : <i data-lucide="copy" className="w-3 h-3"></i>}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* EDITOR MEME */}
                        {memeData && (
                            <div className="p-4 bg-slate-800/50 border border-amber-600/40 rounded-xl shadow-lg">
                                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2 mb-3">
                                    <i data-lucide="edit-2" className="w-4 h-4 text-amber-400"></i>
                                    Editar Meme
                                </h3>
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">
                                            Texto superior
                                        </label>
                                        <input
                                            type="text"
                                            value={memeData.top || ""}
                                            onChange={(e) => setMemeData(prev => ({ ...prev, top: e.target.value.toUpperCase() }))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-amber-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">
                                            Texto inferior
                                        </label>
                                        <input
                                            type="text"
                                            value={memeData.bottom || ""}
                                            onChange={(e) => setMemeData(prev => ({ ...prev, bottom: e.target.value.toUpperCase() }))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-amber-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CONTROLES MANUALES */}
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500 tracking-wider mb-2">
                                    <i data-lucide="sun" className="w-3 h-3"></i> Luz
                                </div>
                                <SliderControl
                                    label="Brillo"
                                    value={currentSettings.brightness}
                                    min={0}
                                    max={200}
                                    onChange={(v) => updateSetting('brightness', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.brightness}
                                />
                                <SliderControl
                                    label="Contraste"
                                    value={currentSettings.contrast}
                                    min={0}
                                    max={200}
                                    onChange={(v) => updateSetting('contrast', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.contrast}
                                />
                                <SliderControl
                                    label="Exposición"
                                    value={currentSettings.exposure}
                                    min={-5}
                                    max={5}
                                    step={0.1}
                                    onChange={(v) => updateSetting('exposure', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.exposure}
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500 tracking-wider mb-2">
                                    <i data-lucide="palette" className="w-3 h-3"></i> Color
                                </div>
                                <SliderControl
                                    label="Saturación"
                                    value={currentSettings.saturation}
                                    min={0}
                                    max={200}
                                    onChange={(v) => updateSetting('saturation', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.saturation}
                                />
                                <SliderControl
                                    label="Temperatura"
                                    value={currentSettings.temperature}
                                    min={-100}
                                    max={100}
                                    onChange={(v) => updateSetting('temperature', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.temperature}
                                />
                                <SliderControl
                                    label="Matiz"
                                    value={currentSettings.hue}
                                    min={0}
                                    max={360}
                                    onChange={(v) => updateSetting('hue', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.hue}
                                />
                                <SliderControl
                                    label="Vibrancia"
                                    value={currentSettings.vibrance}
                                    min={-100}
                                    max={100}
                                    onChange={(v) => updateSetting('vibrance', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.vibrance}
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500 tracking-wider mb-2">
                                    <i data-lucide="wand-2" className="w-3 h-3"></i> Efectos
                                </div>
                                <SliderControl
                                    label="Desenfoque"
                                    value={currentSettings.blur}
                                    min={0}
                                    max={20}
                                    step={0.5}
                                    onChange={(v) => updateSetting('blur', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.blur}
                                />
                                <SliderControl
                                    label="Viñeta"
                                    value={currentSettings.vignette}
                                    min={0}
                                    max={100}
                                    onChange={(v) => updateSetting('vignette', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.vignette}
                                />
                                <SliderControl
                                    label="Nitidez"
                                    value={currentSettings.sharpening}
                                    min={0}
                                    max={100}
                                    onChange={(v) => updateSetting('sharpening', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.sharpening}
                                />
                                <SliderControl
                                    label="Claridad"
                                    value={currentSettings.clarity}
                                    min={-100}
                                    max={100}
                                    onChange={(v) => updateSetting('clarity', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.clarity}
                                />
                                <SliderControl
                                    label="Reducción Ruido"
                                    value={currentSettings.noiseReduction}
                                    min={0}
                                    max={100}
                                    onChange={(v) => updateSetting('noiseReduction', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.noiseReduction}
                                />
                                <SliderControl
                                    label="Grano Cinematográfico"
                                    value={currentSettings.filmGrain}
                                    min={0}
                                    max={100}
                                    onChange={(v) => updateSetting('filmGrain', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.filmGrain}
                                />
                                <SliderControl
                                    label="Efecto Orton"
                                    value={currentSettings.ortonEffect}
                                    min={0}
                                    max={100}
                                    onChange={(v) => updateSetting('ortonEffect', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.ortonEffect}
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500 tracking-wider mb-2">
                                    <i data-lucide="move" className="w-3 h-3"></i> Transformación
                                </div>
                                <SliderControl
                                    label="Zoom (%)"
                                    value={currentSettings.scale}
                                    min={10}
                                    max={300}
                                    onChange={(v) => updateSetting('scale', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.scale}
                                />
                                <SliderControl
                                    label="Rotación"
                                    value={currentSettings.rotation}
                                    min={0}
                                    max={360}
                                    onChange={(v) => updateSetting('rotation', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.rotation}
                                />
                                <div className="text-[10px] text-slate-500 italic mt-1 text-center bg-slate-800/50 rounded py-1">
                                    Arrastra la imagen con el ratón para moverte
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500 tracking-wider mb-2">
                                    <i data-lucide="aperture" className="w-3 h-3"></i> Avanzado
                                </div>
                                <SliderControl
                                    label="Enfoque Selectivo"
                                    value={currentSettings.focalBlur}
                                    min={0}
                                    max={50}
                                    onChange={(v) => updateSetting('focalBlur', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.focalBlur}
                                />
                                <SliderControl
                                    label="Contraste Medios Tonos"
                                    value={currentSettings.midtoneContrast}
                                    min={-100}
                                    max={100}
                                    onChange={(v) => updateSetting('midtoneContrast', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.midtoneContrast}
                                />
                                <SliderControl
                                    label="Efecto HDR"
                                    value={currentSettings.hdrEffect}
                                    min={0}
                                    max={100}
                                    onChange={(v) => updateSetting('hdrEffect', v)}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.hdrEffect}
                                />
                                <SliderControl
                                    label="Balance Blancos (Temp)"
                                    value={currentSettings.whiteBalance.temperature}
                                    min={-100}
                                    max={100}
                                    onChange={(v) => updateSetting('whiteBalance', { ...currentSettings.whiteBalance, temperature: v })}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.whiteBalance_temp}
                                />
                                <SliderControl
                                    label="Balance Blancos (Tint)"
                                    value={currentSettings.whiteBalance.tint}
                                    min={-100}
                                    max={100}
                                    onChange={(v) => updateSetting('whiteBalance', { ...currentSettings.whiteBalance, tint: v })}
                                    onHover={(label) => setHoveredSlider(label)}
                                    description={EFFECT_DESCRIPTIONS.whiteBalance_tint}
                                />
                            </div>
                        </div>

                        {/* TOOLTIP PARA DESLIZADORES */}
                        {hoveredSlider && (
                            <div className="fixed z-50 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl max-w-xs border border-slate-600"
                                style={{
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)'
                                }}
                            >
                                <div className="font-bold mb-1">{hoveredSlider.label}</div>
                                <div>{hoveredSlider.description}</div>
                            </div>
                        )}

                    </div>

                    <div className="p-4 border-t border-slate-800 bg-slate-900">
                        <button
                            onClick={saveToHistory}
                            disabled={!originalImage}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-slate-700 text-white font-bold rounded-lg shadow-lg transition flex justify-center items-center gap-2"
                        >
                            <i data-lucide="save" className="w-4 h-4"></i>
                            <span>GUARDAR Y REINICIAR</span>
                        </button>
                    </div>
                </aside>

                {/* CANVAS */}
                <section className="flex-1 canvas-container flex items-center justify-center relative overflow-hidden bg-slate-950">
                    {!originalImage && (
                        <div className="text-center p-12 border-2 border-dashed border-slate-700/50 rounded-2xl bg-slate-800/30 backdrop-blur-sm max-w-md mx-auto relative z-10 pointer-events-none">
                            <div className="bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i data-lucide="image-plus" className="w-8 h-8 text-slate-500"></i>
                            </div>
                            <h3 className="text-lg font-medium text-slate-200 mb-1">Galería de edición</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Sube imágenes, edítalas y guárdalas en el historial para crear tu colección.
                            </p>
                            <button
                                onClick={() => fileInputRef.current.click()}
                                className="pointer-events-auto px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm font-medium transition"
                            >
                                Subir imagen
                            </button>
                        </div>
                    )}

                    <canvas
                        ref={canvasRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        className={`max-w-full max-h-full object-contain shadow-2xl ring-1 ring-white/10 transition-opacity duration-300 ${!originalImage ? 'opacity-0 absolute' : 'opacity-100'
                            } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    ></canvas>



                    {/* BOTÓN FLOTANTE PARA CANCELAR EDICIÓN DESDE HISTORIAL */}
                    {originalImage && hasOverlayFromHistory && previousImageBeforeEdit && (
                        <button
                            onClick={handleCancelOverlayEdit}
                            className="absolute bottom-4 right-4 px-3 py-1.5 bg-red-600/95 hover:bg-red-500 text-white text-xs font-medium rounded-full shadow-lg flex items-center gap-1 border border-red-400 z-20"
                            title="Eliminar solo esta edición y volver a la imagen anterior"
                        >
                            <i data-lucide="trash-2" className="w-4 h-4"></i>
                            <span>Eliminar solo esta edición</span>
                        </button>
                    )}
                </section>

                {/* HISTORIAL */}
                <aside className="w-64 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-10">
                    <div className="p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
                        <h2 className="font-bold text-sm text-slate-300 flex items-center gap-2">
                            <i data-lucide="history" className="w-4 h-4 text-slate-400"></i>
                            Galería / Historial
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                        {history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-600">
                                <i data-lucide="images" className="w-8 h-8 mb-2 opacity-20"></i>
                                <p className="text-xs text-center px-4">
                                    Las imágenes que guardes aparecerán aquí.
                                </p>
                            </div>
                        ) : (
                            history.map((item, index) => (
                                <div
                                    key={item.id}
                                    onClick={() => restoreFromHistory(item)}
                                    onMouseEnter={() => setHoveredHistoryItem(item.id)}
                                    onMouseLeave={() => setHoveredHistoryItem(null)}
                                    className="group relative bg-slate-800 rounded-lg p-2 border border-slate-700/60 hover:border-blue-500 hover:bg-slate-750 transition-all duration-200 hover:shadow-md cursor-pointer"
                                >
                                    <span className="absolute top-2 left-2 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-sm z-20">
                                        #{history.length - index}
                                    </span>

                                    <div className="relative aspect-square bg-slate-950 rounded mb-2 overflow-hidden border border-slate-800">
                                        <img
                                            src={item.thumbnail}
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                            alt="Versión guardada"
                                        />

                                        {/* Overlay de acciones con iconos + leyenda */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-2 z-10">
                                            <div className="flex w-full gap-2 justify-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownloadHistory(item);
                                                    }}
                                                    className="flex-1 flex flex-col items-center gap-1 text-[9px] text-slate-100"
                                                    title="Descargar esta versión"
                                                >
                                                    <div className="w-7 h-7 rounded-full bg-slate-900/90 border border-slate-500 flex items-center justify-center shadow">
                                                        <i data-lucide="download" className="w-3 h-3"></i>
                                                    </div>
                                                    <span>Descargar</span>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        restoreFromHistory(item);
                                                    }}
                                                    className="flex-1 flex flex-col items-center gap-1 text-[9px] text-sky-100"
                                                    title="Editar esta versión en el lienzo"
                                                >
                                                    <div className="w-7 h-7 rounded-full bg-sky-700/90 border border-sky-400 flex items-center justify-center shadow">
                                                        <i data-lucide="pencil" className="w-3 h-3"></i>
                                                    </div>
                                                    <span>Editar</span>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteHistory(item.id);
                                                    }}
                                                    className="flex-1 flex flex-col items-center gap-1 text-[9px] text-red-100"
                                                    title="Eliminar del historial"
                                                >
                                                    <div className="w-7 h-7 rounded-full bg-red-700/90 border border-red-400 flex items-center justify-center shadow">
                                                        <i data-lucide="trash-2" className="w-3 h-3"></i>
                                                    </div>
                                                    <span>Eliminar</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* TOOLTIP PARA EFECTOS APLICADOS */}
                                    {hoveredHistoryItem === item.id && item.effectsDescription && (
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-slate-800 text-white text-xs p-2 rounded-lg shadow-xl max-w-xs z-30 whitespace-nowrap">
                                            <div className="font-bold mb-1">Efectos aplicados:</div>
                                            <div>{item.effectsDescription}</div>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] text-slate-500 font-mono">
                                            {item.timestamp}
                                        </span>
                                        <span className="text-[10px] text-blue-400">
                                            Versión guardada
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </aside>
            </main>
        </div>
    );
};

const SliderControl = ({ label, value, min, max, step = 1, onChange, onHover, description }) => (
    <div className="group relative">
        <div className="flex justify-between mb-1.5 items-end">
            <label
                className="text-xs text-slate-400 group-hover:text-blue-300 transition-colors font-medium cursor-pointer"
                onMouseEnter={() => onHover({ label, description })}
                onMouseLeave={() => onHover(null)}
            >
                {label}
            </label>
            <span className="text-[10px] text-slate-500 font-mono bg-slate-800 px-1.5 rounded group-hover:text-white transition-colors">
                {Math.round(value * 10) / 10}
            </span>
        </div>
        <div className="relative h-4 flex items-center">
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full z-10 relative"
            />
            <div className="absolute left-0 right-0 h-1 bg-slate-700 rounded-full overflow-hidden top-1/2 -translate-y-1/2 pointer-events-none">
                <div
                    className="h-full bg-blue-600/50"
                    style={{ width: `${((value - min) / (max - min)) * 100}%` }}
                ></div>
            </div>
        </div>
    </div>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);