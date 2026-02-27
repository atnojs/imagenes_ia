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

// --- HISTORIAL PERSISTENTE CON INDEXEDDB ---
const DB_NAME_AJUSTES = 'ajustes_imagen_db';
const DB_VERSION_AJUSTES = 1;
const STORE_NAME_AJUSTES = 'history';

let ajustesDb = null;

const openAjustesDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME_AJUSTES, DB_VERSION_AJUSTES);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { ajustesDb = request.result; resolve(ajustesDb); };
    request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME_AJUSTES)) {
            database.createObjectStore(STORE_NAME_AJUSTES, { keyPath: 'id' });
        }
    };
});

const loadAjustesHistoryFromDb = async () => {
    try {
        if (!ajustesDb) await openAjustesDb();
        return new Promise((resolve, reject) => {
            const tx = ajustesDb.transaction(STORE_NAME_AJUSTES, 'readonly');
            const store = tx.objectStore(STORE_NAME_AJUSTES);
            const req = store.getAll();
            req.onsuccess = () => {
                const items = req.result || [];
                items.sort((a, b) => (b.id || 0) - (a.id || 0));
                resolve(items);
            };
            req.onerror = () => reject(req.error);
        });
    } catch (e) { console.warn('Error cargando historial:', e); return []; }
};

const saveAjustesHistoryItemToDb = async (item) => {
    try {
        if (!ajustesDb) await openAjustesDb();
        return new Promise((resolve, reject) => {
            const tx = ajustesDb.transaction(STORE_NAME_AJUSTES, 'readwrite');
            const store = tx.objectStore(STORE_NAME_AJUSTES);
            const req = store.put(item);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) { console.warn('Error guardando item:', e); }
};

const deleteAjustesHistoryItemFromDb = async (id) => {
    try {
        if (!ajustesDb) await openAjustesDb();
        return new Promise((resolve, reject) => {
            const tx = ajustesDb.transaction(STORE_NAME_AJUSTES, 'readwrite');
            const store = tx.objectStore(STORE_NAME_AJUSTES);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) { console.warn('Error eliminando item:', e); }
};

const clearAjustesHistoryFromDb = async () => {
    try {
        if (!ajustesDb) await openAjustesDb();
        return new Promise((resolve, reject) => {
            const tx = ajustesDb.transaction(STORE_NAME_AJUSTES, 'readwrite');
            const store = tx.objectStore(STORE_NAME_AJUSTES);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) { console.warn('Error limpiando historial:', e); }
};

// Inicializar Firebase
console.log("DEBUG: Initializing Firebase with:", FIREBASE_CONFIG);
if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
}
const auth = firebase.auth();
const db = firebase.firestore();

// --- HELPERS FIREBASE ---
const getTodayDateString = () => new Date().toISOString().split('T')[0];



// Descripciones de los efectos para los tooltips
const EFFECT_DESCRIPTIONS = {
    brightness: "Ajusta el brillo general de la imagen. El resultado debe ser una imagen más clara u oscura, natural y visualmente coherente.",
    contrast: "Controla la diferencia entre las áreas claras y oscuras de la imagen para modificar su impacto visual.",
    saturation: "Intensifica o reduce la intensidad de los colores de la imagen de forma equilibrada.",
    hue: "Desplaza de forma controlada todos los colores a lo largo del espectro cromático para generar un efecto visual creativo.",
    blur: "Aplica un desenfoque suave y uniforme a toda la imagen para generar una sensación etérea o de ensueño.",
    exposure: "Simula el ajuste para controlar la luminosidad general de la imagen.",
    temperature: "Ajusta la temperatura de color de la imagen para desplazarla hacia tonos cálidos o fríos de forma controlada.",
    vignette: "Añade un efecto de viñeta sutil oscureciendo progresivamente los bordes de la imagen para dirigir la atención hacia el centro. Instrucciones técnicas: Aplica una viñeta suave y radial, con transición gradual desde los bordes hacia el área central. Ajusta la intensidad de forma controlada para reforzar el punto focal sin invadir el contenido principal. Mantén el centro con exposición y color intactos. Reglas: Evita bordes duros, cortes visibles o un oscurecimiento excesivo. No alterar de forma perceptible el contraste, la saturación ni el balance de color global. El resultado debe ser elegante, natural y visualmente equilibrado, sin apariencia de filtro artificial.",
    scale: "Amplía o reduce el tamaño de la imagen manteniendo intactas sus proporciones originales.",
    rotation: "Gira la imagen en el sentido de las agujas del reloj.",
    clarity: "Mejora la claridad y definición general de la imagen, incrementando la percepción de detalle sin alterar el equilibrio tonal.",
    vibrance: "Intensifica de forma selectiva los colores menos saturados para lograr una imagen más rica y equilibrada, preservando la naturalidad de los tonos de piel.",
    noiseReduction: "Reduce el ruido digital y la granulosidad de la imagen, especialmente en áreas de bajo contraste.",
    sharpening: "Aumenta la nitidez de los bordes y detalles de la imagen para resaltar texturas y definición.",
    filmGrain: "Añade un grano cinematográfico para aportar un aspecto vintage o artístico.",
    midtoneContrast: "Ajusta el contraste exclusivamente en los tonos medios de la imagen.",
    hdrEffect: "Recupera detalle en altas luces y sombras sin quemar ni empastar.",
    ortonEffect: "Crea una atmósfera etérea y soñadora.",
    focalBlur: "Aplica un desenfoque selectivo del fondo para crear profundidad de campo realista, manteniendo el sujeto principal perfectamente nítido.",
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

// --- FUNCIONES DE DESENFOQUE SIN IA ---
const applyBackgroundBlur = (ctx, canvas, blurAmount = 15) => {
    // Guardar imagen original
    const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Crear canvas temporal con desenfoque aplicado a toda la imagen
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Aplicar desenfoque gaussiano
    tempCtx.filter = `blur(${blurAmount}px)`;
    tempCtx.drawImage(canvas, 0, 0);

    // Crear gradiente radial para el centro (área nítida)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.35;

    const gradient = ctx.createRadialGradient(
        centerX, centerY, radius * 0.3,
        centerX, centerY, radius
    );
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(0.7, 'rgba(0,0,0,0.8)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    // Combinar: imagen desenfocada como base
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);

    // Aplicar máscara para recuperar el centro nítido
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Restaurar áreas fuera del gradiente con la imagen original desenfocada
    ctx.globalCompositeOperation = 'destination-over';
    ctx.drawImage(tempCanvas, 0, 0);

    // Finalmente, poner la imagen original en el centro
    ctx.globalCompositeOperation = 'source-over';
    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = canvas.width;
    originalCanvas.height = canvas.height;
    const originalCtx = originalCanvas.getContext('2d');
    originalCtx.putImageData(originalImageData, 0, 0);

    // Aplicar máscara inversa para el centro
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(originalCanvas, 0, 0);
    ctx.restore();

    // Suavizar el borde entre centro y fondo
    const edgeGradient = ctx.createRadialGradient(
        centerX, centerY, radius * 0.5,
        centerX, centerY, radius * 0.8
    );
    edgeGradient.addColorStop(0, 'rgba(0,0,0,0)');
    edgeGradient.addColorStop(1, 'rgba(0,0,0,0.3)');

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = edgeGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
};

const applyCenterBlur = (ctx, canvas, blurAmount = 15) => {
    // Guardar imagen original
    const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Crear canvas temporal con desenfoque aplicado a toda la imagen
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Aplicar desenfoque gaussiano
    tempCtx.filter = `blur(${blurAmount}px)`;
    tempCtx.drawImage(canvas, 0, 0);

    // Dibujar imagen original (nítida) como base
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(originalImageData, 0, 0);

    // Crear gradiente radial para el centro (área desenfocada)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.35;

    const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius
    );
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.9)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    // Aplicar desenfoque solo en el centro usando composición
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // Crear máscara circular
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Dibujar versión desenfocada en el área recortada
    ctx.filter = `blur(${blurAmount}px)`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';

    ctx.restore();
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

    return effects.length > 0 ? effects.join(', ') : 'Sin efectos aplicados';
};



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
    const [lastRefresh, setLastRefresh] = useState(null); // Hora de última actualización

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
            setLastRefresh(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (e) {
            console.error('Error loading admin data:', e);
            alert('Error cargando datos de Firestore: ' + (e?.message || e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        // Auto-refrescar cada 30 segundos mientras el panel esté abierto
        const intervalId = setInterval(() => {
            loadData();
        }, 30000);

        return () => clearInterval(intervalId);
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
                                <p className="text-sm text-slate-400">
                                    {today} · {lastRefresh ? `Actualizado: ${lastRefresh}` : 'Cargando...'}
                                    <span className="text-emerald-400 ml-2">● Auto-refresh 30s</span>
                                </p>
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
    const [user, setUser] = useState(null);
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [adminPanelOpen, setAdminPanelOpen] = useState(false);

    const [uploadedFile, setUploadedFile] = useState(null);
    const [originalUploadedFile, setOriginalUploadedFile] = useState(null);
    const [originalImage, setOriginalImage] = useState(null);

    const [currentSettings, setCurrentSettings] = useState(INITIAL_SETTINGS);
    const [history, setHistory] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");

    const [shapeOverlays, setShapeOverlays] = useState([]);
    const [selectedShapeIdx, setSelectedShapeIdx] = useState(-1);
    const [isShapeEditing, setIsShapeEditing] = useState(false);
    const [perspectiveModalOpen, setPerspectiveModalOpen] = useState(false);
    const [curvesModalOpen, setCurvesModalOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [memeData, setMemeData] = useState(null);

    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const [copySuccess, setCopySuccess] = useState(false);

    const [previousImageBeforeEdit, setPreviousImageBeforeEdit] = useState(null);
    const [hasOverlayFromHistory, setHasOverlayFromHistory] = useState(false);

    const [hoveredSlider, setHoveredSlider] = useState(null);
    const [hoveredHistoryItem, setHoveredHistoryItem] = useState(null);
    const [hoveredButton, setHoveredButton] = useState(null);

    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [resizeModalOpen, setResizeModalOpen] = useState(false);
    const [rotateModalOpen, setRotateModalOpen] = useState(false);
    const [borderModalOpen, setBorderModalOpen] = useState(false);
    const [isColorPickerActive, setIsColorPickerActive] = useState(false);
    const [textModalOpen, setTextModalOpen] = useState(false);
    const [isTextEditing, setIsTextEditing] = useState(false);
    const [textOverlays, setTextOverlays] = useState([]);
    const [selectedTextIdx, setSelectedTextIdx] = useState(-1);
    const [lastAppliedTexts, setLastAppliedTexts] = useState(null);
    const [preTextImage, setPreTextImage] = useState(null);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
    const [manualActions, setManualActions] = useState([]);

    const canvasRef = useRef(null);
    const canvasContainerRef = useRef(null);
    const textOverlaysRef = useRef([]); // Always-fresh ref for stale closure safety
    const isReEditingRef = useRef(false); // true when re-editing previously applied texts
    const preReEditImageRef = useRef(null); // snapshot of image before re-edit started
    const fileInputRef = useRef(null);

    // Sync textOverlays ref
    useEffect(() => { textOverlaysRef.current = textOverlays; }, [textOverlays]);

    // Cargar historial desde IndexedDB al montar
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const items = await loadAjustesHistoryFromDb();
                if (items.length > 0) setHistory(items);
            } catch (e) { console.warn('Error cargando historial:', e); }
        };
        loadHistory();
    }, []);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setAuthModalOpen(true);
            } else {
                setAuthModalOpen(false);
                const userRef = db.collection('users').doc(currentUser.uid);
                await userRef.set({
                    email: currentUser.email,
                    lastActive: new Date()
                }, { merge: true });
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
                setOriginalUploadedFile(event.target.result);
                setOriginalImage(event.target.result);
                setCurrentSettings(INITIAL_SETTINGS);
                setStatusMessage("");
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

    // --- Estado del cursor circular del Color Picker ---
    const [colorPickerPos, setColorPickerPos] = useState({ x: 0, y: 0 });
    const [colorPickerColor, setColorPickerColor] = useState('#000000');

    const handleMouseDown = (e) => {
        if (isColorPickerActive) {
            handleColorPick(e);
            return;
        }
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseMove = (e) => {
        // Color Picker: muestrear color bajo el cursor en tiempo real
        if (isColorPickerActive && canvasRef.current) {
            const canvas = canvasRef.current;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const px = (e.clientX - rect.left) * scaleX;
            const py = (e.clientY - rect.top) * scaleY;
            if (px >= 0 && py >= 0 && px < canvas.width && py < canvas.height) {
                const ctx = canvas.getContext('2d');
                const pixel = ctx.getImageData(Math.round(px), Math.round(py), 1, 1).data;
                const hex = `#${[pixel[0], pixel[1], pixel[2]].map(c => c.toString(16).padStart(2, '0')).join('')}`;
                setColorPickerColor(hex);
            }
            // Posición del cursor flotante relativa al contenedor del canvas
            const container = canvasContainerRef.current;
            if (container) {
                const cRect = container.getBoundingClientRect();
                setColorPickerPos({ x: e.clientX - cRect.left, y: e.clientY - cRect.top });
            }
            return;
        }
        if (!isDragging) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        dragStart.current = { x: e.clientX, y: e.clientY };
        setCurrentSettings(prev => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }));
    };
    const handleMouseUp = () => setIsDragging(false);

    const saveToHistory = async () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;

        const savedImage = canvas.toDataURL('image/jpeg', 0.9);
        const thumbUrl = canvas.toDataURL('image/jpeg', 0.5);

        let effectsDescription = getEffectsDescription(currentSettings);

        if (manualActions.length > 0) {
            effectsDescription = manualActions.join(', ') + (effectsDescription ? ', ' + effectsDescription : '');
        }

        const newHistoryItem = {
            id: Date.now(),
            thumbnail: thumbUrl,
            originalSource: savedImage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            settings: { ...currentSettings },
            effectsDescription: effectsDescription,
            manualActions: [...manualActions]
        };

        await saveAjustesHistoryItemToDb(newHistoryItem);
        setHistory(prev => [newHistoryItem, ...prev]);

        if (originalUploadedFile) setOriginalImage(originalUploadedFile);
        setUploadedFile(originalUploadedFile);
        setCurrentSettings(INITIAL_SETTINGS);
        setMemeData(null);
        setStatusMessage("¡Guardado! Lienzo restaurado a la imagen original.");
        setPreviousImageBeforeEdit(null);
        setHasOverlayFromHistory(false);

        setManualActions([]);

        setTimeout(() => setStatusMessage(""), 2000);
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

    const handleDeleteHistory = async (id) => {
        await deleteAjustesHistoryItemFromDb(id);
        setHistory(prev => prev.filter(item => item.id !== id));
    };

    const handleDeleteCurrentImage = () => {
        setOriginalImage(null);
        setUploadedFile(null);
        setOriginalUploadedFile(null); // Limpiar también la imagen original
        setCurrentSettings(INITIAL_SETTINGS);
        setMemeData(null);
        setPalette([]);
        setStatusMessage("");
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

    // --- FUNCIONES DE RECORTE ---
    const handleOpenCropModal = () => {
        if (!originalImage) {
            setStatusMessage("Primero debes subir una imagen para recortar");
            setTimeout(() => setStatusMessage(""), 3000);
            return;
        }
        setCropModalOpen(true);
    };

    const handleCropComplete = (croppedImage) => {
        setOriginalImage(croppedImage);
        setUploadedFile(croppedImage);
        setManualActions(prev => [...prev, "Recorte"]);
        setCurrentSettings(INITIAL_SETTINGS);
        setMemeData(null);
        setStatusMessage("Imagen recortada correctamente");
        setTimeout(() => setStatusMessage(""), 3000);
    };

    const handleCenterBlur = () => {
        if (!originalImage) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, 0, 0);
            applyCenterBlur(ctx, canvas, 20);

            const blurredImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(blurredImage);
            setUploadedFile(blurredImage);
            setManualActions(prev => [...prev, "Difuminar Centro"]);
            setCurrentSettings(INITIAL_SETTINGS);
            setMemeData(null);

            setStatusMessage("Centro difuminado aplicado");
            setTimeout(() => setStatusMessage(""), 3000);
        };
        img.src = originalImage;
    };

    const handleColorPick = (e) => {
        if (!canvasRef.current || !originalImage) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const ctx = canvas.getContext('2d');
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const color = `#${[pixel[0], pixel[1], pixel[2]].map(c => c.toString(16).padStart(2, '0')).join('')}`;

        copyColor(color);
        setIsColorPickerActive(false);
        setStatusMessage(`Color copiado: ${color}`);
        setTimeout(() => setStatusMessage(""), 2000);
    };

    const applyFilter = (filterType) => {
        if (!originalImage) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            switch (filterType) {
                case 'bw':
                    // Blanco y Negro (promedio ponderado)
                    for (let i = 0; i < data.length; i += 4) {
                        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                        data[i] = gray;
                        data[i + 1] = gray;
                        data[i + 2] = gray;
                    }
                    ctx.putImageData(imageData, 0, 0);
                    break;

                case 'sepia':
                    // Sepia
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                        data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                        data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                    }
                    ctx.putImageData(imageData, 0, 0);
                    break;

                case 'high-contrast':
                    // Alto Contraste: Ajuste agresivo de contraste
                    const contrast = 100; // Valor entre 0 y 255 (100 es bastante fuerte)
                    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

                    for (let i = 0; i < data.length; i += 4) {
                        data[i] = factor * (data[i] - 128) + 128; // R
                        data[i + 1] = factor * (data[i + 1] - 128) + 128; // G
                        data[i + 2] = factor * (data[i + 2] - 128) + 128; // B
                        // Clamping
                        data[i] = Math.max(0, Math.min(255, data[i]));
                        data[i + 1] = Math.max(0, Math.min(255, data[i + 1]));
                        data[i + 2] = Math.max(0, Math.min(255, data[i + 2]));
                    }
                    ctx.putImageData(imageData, 0, 0);
                    break;

                case 'vintage':
                    // Vintage: sepia + contraste reducido + viñeta
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        // Sepia suave
                        data[i] = Math.min(255, (r * 0.9) + (g * 0.4) + (b * 0.1));
                        data[i + 1] = Math.min(255, (r * 0.3) + (g * 0.8) + (b * 0.1));
                        data[i + 2] = Math.min(255, (r * 0.2) + (g * 0.4) + (b * 0.6));
                        // Reducir contraste
                        for (let j = 0; j < 3; j++) {
                            data[i + j] = data[i + j] * 0.85 + 25;
                        }
                    }
                    ctx.putImageData(imageData, 0, 0);

                    // Añadir viñeta
                    ctx.globalCompositeOperation = 'multiply';
                    const gradient = ctx.createRadialGradient(
                        canvas.width / 2, canvas.height / 2, canvas.width * 0.4,
                        canvas.width / 2, canvas.height / 2, canvas.width * 0.8
                    );
                    gradient.addColorStop(0, 'rgba(255,255,255,0)');
                    gradient.addColorStop(1, 'rgba(80,60,40,0.5)');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.globalCompositeOperation = 'source-over';
                    break;

                case 'noir':
                    // Noir: B&W con alto contraste
                    for (let i = 0; i < data.length; i += 4) {
                        let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                        // Aumentar contraste
                        gray = (gray - 128) * 1.5 + 128;
                        gray = Math.max(0, Math.min(255, gray));
                        data[i] = gray;
                        data[i + 1] = gray;
                        data[i + 2] = gray;
                    }
                    ctx.putImageData(imageData, 0, 0);
                    break;

                case 'polaroid': {
                    // Polaroid: Marco blanco con imagen encogida y borde inferior más grande
                    const padSide = Math.min(canvas.width, canvas.height) * 0.06;
                    const padBottom = padSide * 2.5; // borde inferior más grande (estilo Polaroid)
                    const newW = canvas.width + padSide * 2;
                    const newH = canvas.height + padSide + padBottom;

                    // Crear canvas nuevo con el tamaño del marco
                    const polaroidCanvas = document.createElement('canvas');
                    polaroidCanvas.width = newW;
                    polaroidCanvas.height = newH;
                    const pCtx = polaroidCanvas.getContext('2d');

                    // Fondo blanco
                    pCtx.fillStyle = '#ffffff';
                    pCtx.fillRect(0, 0, newW, newH);

                    // Sombra sutil
                    pCtx.shadowColor = 'rgba(0,0,0,0.15)';
                    pCtx.shadowBlur = 12;
                    pCtx.shadowOffsetX = 2;
                    pCtx.shadowOffsetY = 4;

                    // Dibujar la imagen original centrada dentro del marco
                    pCtx.drawImage(img, padSide, padSide, canvas.width, canvas.height);

                    // Transferir resultado al canvas principal
                    canvas.width = newW;
                    canvas.height = newH;
                    ctx.drawImage(polaroidCanvas, 0, 0);
                    break;
                }
            }

            const filteredImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(filteredImage);
            setUploadedFile(filteredImage);

            const filterNames = {
                'bw': 'Blanco y Negro',
                'sepia': 'Sepia',
                'vintage': 'Vintage',
                'high-contrast': 'Alto Contraste',
                'noir': 'Noir',
                'polaroid': 'Polaroid'
            };
            setManualActions(prev => [...prev, `Filtro: ${filterNames[filterType]}`]);
            setCurrentSettings(INITIAL_SETTINGS);
            setMemeData(null);

            setStatusMessage(`Filtro ${filterNames[filterType]} aplicado`);
            setTimeout(() => setStatusMessage(""), 3000);
        };
        img.src = originalImage;
    };

    // --- FUNCIONES DE TRANSFORMACIÓN ---
    const handleFlipHorizontal = () => {
        if (!originalImage) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0);

            const flippedImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(flippedImage);
            setUploadedFile(flippedImage);
            setManualActions(prev => [...prev, "Espejo horizontal"]);
            setCurrentSettings(INITIAL_SETTINGS);

            setStatusMessage("Imagen volteada horizontalmente");
            setTimeout(() => setStatusMessage(""), 3000);
        };
        img.src = originalImage;
    };

    const handleFlipVertical = () => {
        if (!originalImage) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            ctx.translate(0, canvas.height);
            ctx.scale(1, -1);
            ctx.drawImage(img, 0, 0);

            const flippedImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(flippedImage);
            setUploadedFile(flippedImage);
            setManualActions(prev => [...prev, "Espejo vertical"]);
            setCurrentSettings(INITIAL_SETTINGS);

            setStatusMessage("Imagen volteada verticalmente");
            setTimeout(() => setStatusMessage(""), 3000);
        };
        img.src = originalImage;
    };

    const handleRotate90 = () => {
        if (!originalImage) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.height;
            canvas.height = img.width;
            const ctx = canvas.getContext('2d');

            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(90 * Math.PI / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            const rotatedImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(rotatedImage);
            setUploadedFile(rotatedImage);
            setManualActions(prev => [...prev, "Rotar 90°"]);
            setCurrentSettings(INITIAL_SETTINGS);

            setStatusMessage("Imagen rotada 90°");
            setTimeout(() => setStatusMessage(""), 3000);
        };
        img.src = originalImage;
    };

    // --- FUNCIONES ADICIONALES SIN IA ---
    const handleResize = (newWidth, newHeight) => {
        if (!originalImage) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            const resizedImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(resizedImage);
            setUploadedFile(resizedImage);
            setManualActions(prev => [...prev, `Redimensionar: ${newWidth}x${newHeight}`]);
            setCurrentSettings(INITIAL_SETTINGS);

            setStatusMessage(`Imagen redimensionada a ${newWidth}x${newHeight}`);
            setTimeout(() => setStatusMessage(""), 3000);
        };
        img.src = originalImage;
    };

    const handleRotateFree = (angle) => {
        if (!originalImage) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const rad = angle * Math.PI / 180;
            const sin = Math.abs(Math.sin(rad));
            const cos = Math.abs(Math.cos(rad));
            canvas.width = img.width * cos + img.height * sin;
            canvas.height = img.width * sin + img.height * cos;
            const ctx = canvas.getContext('2d');

            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(rad);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            const rotatedImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(rotatedImage);
            setUploadedFile(rotatedImage);
            setManualActions(prev => [...prev, `Rotar ${angle}°`]);
            setCurrentSettings(INITIAL_SETTINGS);

            setStatusMessage(`Imagen rotada ${angle}°`);
            setTimeout(() => setStatusMessage(""), 3000);
        };
        img.src = originalImage;
    };

    const handleAddBorder = (borderWidth, borderColor) => {
        if (!originalImage) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width + borderWidth * 2;
            canvas.height = img.height + borderWidth * 2;
            const ctx = canvas.getContext('2d');

            // Dibujar borde
            ctx.fillStyle = borderColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Dibujar imagen centrada
            ctx.drawImage(img, borderWidth, borderWidth);

            const borderedImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(borderedImage);
            setUploadedFile(borderedImage);
            setManualActions(prev => [...prev, `Marco: ${borderWidth}px`]);
            setCurrentSettings(INITIAL_SETTINGS);

            setStatusMessage(`Marco añadido (${borderWidth}px)`);
            setTimeout(() => setStatusMessage(""), 3000);
        };
        img.src = originalImage;
    };

    const handlePixelate = (pixelSize = 10) => {
        if (!originalImage) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            // Dibujar imagen pequeña
            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = img.width / pixelSize;
            smallCanvas.height = img.height / pixelSize;
            const smallCtx = smallCanvas.getContext('2d');
            smallCtx.drawImage(img, 0, 0, smallCanvas.width, smallCanvas.height);

            // Dibujar pequeña a tamaño original (pixelado)
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(smallCanvas, 0, 0, canvas.width, canvas.height);

            const pixelatedImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(pixelatedImage);
            setUploadedFile(pixelatedImage);
            setManualActions(prev => [...prev, "Pixelado"]);
            setCurrentSettings(INITIAL_SETTINGS);

            setStatusMessage("Efecto pixelado aplicado");
            setTimeout(() => setStatusMessage(""), 3000);
        };
        img.src = originalImage;
    };

    // --- TEXTO INTERACTIVO (MULTI-CAPA) ---
    const addNewTextOverlay = () => {
        const text = prompt("Escribe el texto:");
        if (!text || !text.trim()) return false;
        const currentLen = textOverlaysRef.current.length;
        const newOverlay = {
            text: text.trim(),
            x: 20 + (currentLen * 5) % 30,
            y: 30 + (currentLen * 5) % 20,
            width: 50,
            height: 20,
            fontSize: 36,
            color: '#0ae674',
            fontFamily: 'Arial'
        };
        setTextOverlays(prev => [...prev, newOverlay]);
        setSelectedTextIdx(currentLen);
        return true;
    };

    const startTextEditing = () => {
        if (!originalImage) return;

        // If there are previously applied texts, offer to re-edit them
        if (lastAppliedTexts && lastAppliedTexts.length > 0 && preTextImage) {
            const choice = confirm(
                `Tienes ${lastAppliedTexts.length} texto(s) aplicado(s).\n\n` +
                `¿Quieres editarlos?\n\n` +
                `Aceptar = Editar textos existentes\n` +
                `Cancelar = Añadir texto nuevo`
            );
            if (choice) {
                // Save current image so cancel can restore it
                preReEditImageRef.current = originalImage;
                isReEditingRef.current = true;

                // Restore pre-text image and re-open overlays for editing
                setOriginalImage(preTextImage);
                setUploadedFile(preTextImage);
                setTextOverlays(lastAppliedTexts.map(o => ({ ...o })));
                setSelectedTextIdx(0);
                setIsTextEditing(true);
                // Redraw canvas with pre-text image
                const canvas = canvasRef.current;
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0);
                    };
                    img.src = preTextImage;
                }
                return;
            }
        }

        // Add new text
        isReEditingRef.current = false;
        if (addNewTextOverlay()) {
            // Save current image as pre-text baseline if not already set
            if (!preTextImage) {
                setPreTextImage(originalImage);
            }
            setIsTextEditing(true);
        }
    };

    const updateSelectedOverlay = (updates) => {
        if (selectedTextIdx < 0) return;
        setTextOverlays(prev => prev.map((o, i) => i === selectedTextIdx ? { ...o, ...updates } : o));
    };

    const deleteTextOverlay = (idx) => {
        const currentLen = textOverlaysRef.current.length;
        setTextOverlays(prev => prev.filter((_, i) => i !== idx));
        if (selectedTextIdx === idx) {
            setSelectedTextIdx(currentLen > 1 ? Math.max(0, idx - 1) : -1);
        } else if (selectedTextIdx > idx) {
            setSelectedTextIdx(prev => prev - 1);
        }
        // If no overlays left, exit edit mode
        if (currentLen <= 1) {
            setIsTextEditing(false);
        }
    };

    const applyTextOverlay = () => {
        // Use ref for always-fresh overlays (avoids stale closure)
        const currentOverlays = textOverlaysRef.current;
        if (!originalImage || currentOverlays.length === 0 || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const container = canvasContainerRef.current;
        if (!container) return;

        const canvasRect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / canvasRect.width;
        const scaleY = canvas.height / canvasRect.height;
        const containerRect = container.getBoundingClientRect();
        const canvasOffsetX = canvasRect.left - containerRect.left;
        const canvasOffsetY = canvasRect.top - containerRect.top;

        const ctx = canvas.getContext('2d');

        // Draw ALL text overlays
        const textNames = [];
        currentOverlays.forEach(ov => {
            const overlayPxX = (ov.x / 100) * containerRect.width;
            const overlayPxY = (ov.y / 100) * containerRect.height;
            const overlayPxW = (ov.width / 100) * containerRect.width;
            const overlayPxH = (ov.height / 100) * containerRect.height;

            const textPxX = (overlayPxX - canvasOffsetX) * scaleX;
            const textPxY = (overlayPxY - canvasOffsetY) * scaleY;
            const textPxW = overlayPxW * scaleX;
            const textPxH = overlayPxH * scaleY;

            const scaledFontSize = ov.fontSize * scaleX;
            ctx.font = `bold ${scaledFontSize}px ${ov.fontFamily}`;
            ctx.fillStyle = ov.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 4 * scaleX;
            ctx.shadowOffsetX = 2 * scaleX;
            ctx.shadowOffsetY = 2 * scaleY;

            const centerX = textPxX + textPxW / 2;
            const centerY = textPxY + textPxH / 2;

            // Word wrap
            const words = ov.text.split(' ');
            const maxWidth = textPxW * 0.9;
            const lines = [];
            let currentLine = '';
            words.forEach(word => {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                if (ctx.measureText(testLine).width > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            });
            if (currentLine) lines.push(currentLine);

            const lineHeight = scaledFontSize * 1.2;
            const totalTextHeight = lines.length * lineHeight;
            const startY = centerY - totalTextHeight / 2 + lineHeight / 2;
            lines.forEach((line, i) => {
                ctx.fillText(line, centerX, startY + i * lineHeight);
            });

            textNames.push(ov.text.substring(0, 15));
        });

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Save pre-text image before burning
        if (!preTextImage) {
            setPreTextImage(originalImage);
        }

        const imageWithText = canvas.toDataURL('image/jpeg', 0.95);
        setOriginalImage(imageWithText);
        setUploadedFile(imageWithText);

        // Save deep copy of overlays for re-editing later
        if (isReEditingRef.current) {
            // Re-editing: replace all tracked texts with the current set
            setLastAppliedTexts(currentOverlays.map(o => ({ ...o })));
        } else {
            // Adding new: accumulate onto previously tracked texts
            setLastAppliedTexts(prev => [
                ...(prev || []),
                ...currentOverlays.map(o => ({ ...o }))
            ]);
        }
        isReEditingRef.current = false;
        preReEditImageRef.current = null;

        const desc = textNames.length === 1
            ? `Texto: "${textNames[0]}${textNames[0].length >= 15 ? '...' : ''}"`
            : `${textNames.length} Textos`;
        setManualActions(prev => [...prev, desc]);
        setCurrentSettings(INITIAL_SETTINGS);
        setIsTextEditing(false);
        setTextOverlays([]);
        setSelectedTextIdx(-1);
        setStatusMessage(textNames.length === 1 ? "Texto añadido" : `${textNames.length} textos añadidos`);
        setTimeout(() => setStatusMessage(""), 3000);
    };

    const cancelTextOverlay = () => {
        // If we were re-editing, restore the snapshot image from before re-edit
        if (isReEditingRef.current && preReEditImageRef.current) {
            const snapshotImage = preReEditImageRef.current;
            setOriginalImage(snapshotImage);
            setUploadedFile(snapshotImage);
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                const img = new Image();
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                };
                img.src = snapshotImage;
            }
        }
        isReEditingRef.current = false;
        preReEditImageRef.current = null;
        setIsTextEditing(false);
        setTextOverlays([]);
        setSelectedTextIdx(-1);
    };

const updateSetting = (key, value) => {
        setCurrentSettings(prev => ({ ...prev, [key]: parseFloat(value) }));
    };

    // Copia un color al portapapeles con fallback para entornos sin HTTPS
    const copyColor = (color) => {
        const doCopy = () => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(color).catch(() => fallbackCopy(color));
            } else {
                return fallbackCopy(color);
            }
        };
        const fallbackCopy = (text) => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try { document.execCommand('copy'); } catch (e) { /* silently fail */ }
            document.body.removeChild(textarea);
        };
        doCopy();
        setStatusMessage(`Color ${color} copiado.`);
        setTimeout(() => setStatusMessage(""), 2000);
    };

    // --- NEW FEATURES HANDLERS ---

    // Auto White Balance
    const handleAutoWhiteBalance = () => {
        if (!originalImage) return;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Gray World Assumption
            let rSum = 0, gSum = 0, bSum = 0;
            for (let i = 0; i < data.length; i += 4) {
                rSum += data[i];
                gSum += data[i + 1];
                bSum += data[i + 2];
            }
            const numPixels = data.length / 4;
            const avgR = rSum / numPixels || 1;
            const avgG = gSum / numPixels || 1;
            const avgB = bSum / numPixels || 1;

            const avgGray = (avgR + avgG + avgB) / 3;
            const gainR = avgGray / avgR;
            const gainG = avgGray / avgG;
            const gainB = avgGray / avgB;

            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, data[i] * gainR);
                data[i + 1] = Math.min(255, data[i + 1] * gainG);
                data[i + 2] = Math.min(255, data[i + 2] * gainB);
            }
            ctx.putImageData(imageData, 0, 0);
            setOriginalImage(canvas.toDataURL());
            setUploadedFile(canvas.toDataURL());
            setStatusMessage("Balance de blancos auto aplicado");
            setTimeout(() => setStatusMessage(""), 2000);
        };
        img.src = originalImage;
    };

    // Shapes
    const startShapeEditing = () => {
        setIsShapeEditing(true);
        if (shapeOverlays.length === 0) {
            addNewShape('rect');
        }
    };

    const addNewShape = (type) => {
        const newOverlay = {
            id: Date.now(),
            type: type,
            x: 40, y: 40, width: 20, height: 20,
            color: '#0ae674',
            filled: false
        };
        setShapeOverlays(prev => [...prev, newOverlay]);
        setSelectedShapeIdx(shapeOverlays.length);
    };

    const deleteShape = (idx) => {
        setShapeOverlays(prev => prev.filter((_, i) => i !== idx));
        if (selectedShapeIdx >= idx) setSelectedShapeIdx(-1);
    };

    const applyShapeOverlay = () => {
        if (!originalImage || shapeOverlays.length === 0 || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const container = canvasContainerRef.current;
        if (!container) return;

        // Needed for scaling coords
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scaleX = canvas.width / canvasRect.width;
        const scaleY = canvas.height / canvasRect.height;
        const canvasOffsetX = canvasRect.left - containerRect.left;
        const canvasOffsetY = canvasRect.top - containerRect.top;

        const ctx = canvas.getContext('2d');

        shapeOverlays.forEach(ov => {
            const overlayPxX = (ov.x / 100) * containerRect.width;
            const overlayPxY = (ov.y / 100) * containerRect.height;
            const overlayPxW = (ov.width / 100) * containerRect.width;
            const overlayPxH = (ov.height / 100) * containerRect.height;

            const x = (overlayPxX - canvasOffsetX) * scaleX;
            const y = (overlayPxY - canvasOffsetY) * scaleY;
            const w = overlayPxW * scaleX;
            const h = overlayPxH * scaleY;

            ctx.fillStyle = ov.filled ? ov.color : 'transparent';
            ctx.strokeStyle = ov.color;
            ctx.lineWidth = 3 * scaleX;

            ctx.beginPath();
            if (ov.type === 'circle') {
                ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
            } else {
                ctx.rect(x, y, w, h);
            }
            if (ov.filled) ctx.fill();
            ctx.stroke();
        });

        const imageWithShapes = canvas.toDataURL('image/jpeg', 0.95);
        setOriginalImage(imageWithShapes);
        setUploadedFile(imageWithShapes);
        setShapeOverlays([]);
        setIsShapeEditing(false);
        setStatusMessage("Formas aplicadas");
        setTimeout(() => setStatusMessage(""), 2000);
    };

    const handleApplyExternalEdit = (newImageSrc) => {
        setOriginalImage(newImageSrc);
        setUploadedFile(newImageSrc);
        setStatusMessage("Cambios aplicados");
        setTimeout(() => setStatusMessage(""), 2000);
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-300 font-sans">
            {/* 🔥 Overlay de carga con fondo animado */}
            {isProcessing && (
                <div className="loading-overlay">
                    <div className="spinner-triple">
                        <div className="ring ring-1"></div>
                        <div className="ring ring-2"></div>
                        <div className="ring ring-3"></div>
                    </div>
                    <p className="loading-text">Procesando...</p>
                </div>
            )}

            {/* MODAL DE LOGIN */}
            {!user && authModalOpen && <AuthModal />}

            {/* PANEL DE ADMIN */}
            {adminPanelOpen && <AdminPanel onClose={() => setAdminPanelOpen(false)} />}

            {/* MODAL DE RECORTE */}
            {cropModalOpen && (
                <CropModal
                    imageSrc={originalImage}
                    onClose={() => setCropModalOpen(false)}
                    onCrop={handleCropComplete}
                />
            )}

            {/* MODAL DE REDIMENSIONAR */}
            {resizeModalOpen && (
                <ResizeModal
                    imageSrc={originalImage}
                    onClose={() => setResizeModalOpen(false)}
                    onResize={handleResize}
                />
            )}

            {/* MODAL DE ROTACIÓN LIBRE */}
            {rotateModalOpen && (
                <RotateModal
                    onClose={() => setRotateModalOpen(false)}
                    onRotate={handleRotateFree}
                />
            )}

            {/* MODAL DE MARCO */}
            {borderModalOpen && (
                <BorderModal
                    onClose={() => setBorderModalOpen(false)}
                    onAddBorder={handleAddBorder}
                />
            )}

            {/* NEW FEATURES MODALS */}
            {perspectiveModalOpen && (
                <PerspectiveModal
                    imageSrc={originalImage}
                    onClose={() => setPerspectiveModalOpen(false)}
                    onApply={handleApplyExternalEdit}
                />
            )}
            {curvesModalOpen && (
                <CurvesModal
                    imageSrc={originalImage}
                    onClose={() => setCurvesModalOpen(false)}
                    onApply={handleApplyExternalEdit}
                />
            )}
            {exportModalOpen && (
                <ExportModal
                    imageSrc={originalImage}
                    onClose={() => setExportModalOpen(false)}
                    onExport={() => setStatusMessage("Imagen exportada")}
                />
            )}

            {/* MODAL DE TEXTO - Ahora usa overlay interactivo */}

            <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-2 text-blue-400 select-none">
                    <i data-lucide="aperture" className="w-6 h-6"></i>
                    <h1 className="font-bold text-lg text-white tracking-tight">
                        <span className="font-light text-blue-200">Editor de Imágenes</span>
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
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm font-medium transition flex items-center gap-2 border border-slate-600 btn-3d"
                    >
                        <i data-lucide="upload" className="w-4 h-4"></i>
                        <span className="hidden sm:inline">Subir Otra Imagen</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {/* PANEL IZQUIERDO */}
                <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-10">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                        <div className="p-4 bg-gradient-to-br from-indigo-900/50 to-slate-900 rounded-xl border border-indigo-500/40 shadow-lg relative overflow-hidden">
                            <div className="flex justify-between items-center mb-3">

                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <i data-lucide="wrench" className="w-3 h-3"></i> Herramientas Locales
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: "Recortar", label: "Recortar", icon: "crop", func: handleOpenCropModal, desc: "Recorta la imagen manualmente seleccionando el área deseada." },
                                            { id: "Difuminar Centro", label: "Difuminar Centro", icon: "circle-dot", func: handleCenterBlur, desc: "Difumina el centro manteniendo el fondo nítido. Efecto artístico único." },
                                            { id: "B&N", label: "B&N", icon: "contrast", func: () => applyFilter('bw'), desc: "Convierte la imagen a blanco y negro." },
                                            { id: "Sepia", label: "Sepia", icon: "coffee", func: () => applyFilter('sepia'), desc: "Aplica efecto sepia vintage." },
                                            { id: "Vintage", label: "Vintage", icon: "camera", func: () => applyFilter('vintage'), desc: "Efecto vintage con tono cálido y viñeta." },
                                            { id: "Noir", label: "Noir", icon: "moon", func: () => applyFilter('noir'), desc: "Blanco y negro con alto contraste estilo película negra." },
                                            { id: "Polaroid", label: "Polaroid", icon: "camera", func: () => applyFilter('polaroid'), desc: "Añade un marco blanco estilo Polaroid." },
                                            { id: "Espejo H", label: "Espejo H", icon: "flip-horizontal", func: handleFlipHorizontal, desc: "Voltea la imagen horizontalmente (efecto espejo)." },
                                            { id: "Espejo V", label: "Espejo V", icon: "flip-vertical", func: handleFlipVertical, desc: "Voltea la imagen verticalmente." },
                                            { id: "Rotar 90°", label: "Rotar 90°", icon: "rotate-cw", func: handleRotate90, desc: "Rota la imagen 90 grados en sentido horario." },
                                            { id: "Redimensionar", label: "Redimensionar", icon: "maximize", func: () => setResizeModalOpen(true), desc: "Cambia el tamaño de la imagen a dimensiones específicas." },
                                            { id: "Rotar Libre", label: "Rotar Libre", icon: "rotate-ccw", func: () => setRotateModalOpen(true), desc: "Rota la imagen a cualquier ángulo personalizado." },
                                            { id: "Marco", label: "Marco", icon: "square", func: () => setBorderModalOpen(true), desc: "Añade un marco/borde decorativo a la imagen." },
                                            { id: "Perspectiva", label: "Perspectiva", icon: "scaling", func: () => setPerspectiveModalOpen(true), desc: "Corrige la perspectiva (Keystone) vertical u horizontal." },
                                            { id: "Curvas", label: "Curvas", icon: "spline", func: () => setCurvesModalOpen(true), desc: "Ajusta las curvas de tono (RGB) detalladamente." },
                                            { id: "Bal. Blancos", label: "Bal. Blancos", icon: "sun", func: handleAutoWhiteBalance, desc: "Ajuste automático de temperatura de color (Gray World)." },
                                            { id: "Color Picker", label: "Color Picker", icon: "pipette", func: () => { setIsColorPickerActive(!isColorPickerActive); setStatusMessage(isColorPickerActive ? "Selector desactivado" : "Haz clic en la imagen para copiar el color"); }, desc: "Selecciona un color de la imagen y cópialo. (Haz clic en la imagen)", active: isColorPickerActive },
                                            { id: "Texto", label: "Texto", icon: "type", func: startTextEditing, desc: "Añade texto interactivo sobre la imagen." },
                                            { id: "Pixelar", label: "Pixelar", icon: "grid-3x3", func: () => handlePixelate(10), desc: "Aplica efecto pixelado a la imagen." },
                                            { id: "Exportar", label: "Exportar", icon: "download", func: () => setExportModalOpen(true), desc: "Opciones avanzadas de guardado (Formato, Calidad).", active: false }
                                        ].map((btn) => (
                                            <button
                                                key={btn.id}
                                                onClick={() => { btn.func(); }}
                                                disabled={!originalImage || isProcessing}
                                                onMouseEnter={() => setHoveredButton({ label: btn.label, description: btn.desc })}
                                                onMouseLeave={() => setHoveredButton(null)}
                                                className={`py-1.5 text-[10px] rounded border transition-all duration-200 flex justify-center items-center gap-1 ${hoveredButton?.label === btn.label || btn.active
                                                    ? "bg-blue-600 border-blue-300 text-white scale-[1.05] z-10 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                                    : "bg-slate-700 border-slate-600 text-slate-200"
                                                    }`}
                                            >
                                                <i data-lucide={btn.icon} className="w-3 h-3"></i> {btn.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {hoveredButton && (
                                    <div className="relative min-h-[60px] p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 overflow-hidden">
                                        <div className="text-blue-300 font-bold text-sm tracking-wide border-b border-white/10 pb-1 mb-1">
                                            {hoveredButton.label}
                                        </div>
                                        <div className="text-slate-200 font-light text-[12px] leading-tight">
                                            {hoveredButton.description}
                                        </div>
                                    </div>
                                )}
                            </div>


                            {statusMessage && (
                                <div className="mt-3 relative group">
                                    <div className="text-[10px] font-mono p-3 bg-black/40 border border-indigo-500/20 rounded-lg text-indigo-200 break-words max-h-64 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                                        {statusMessage}
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(statusMessage);
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

                            </div>
                        </div>

                        {/* TOOLTIP PARA DESLIZADORES */}
                        {hoveredSlider && (
                            <div className="glass-popup pointer-events-none fixed z-50 p-4 w-64"
                                style={{
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)'
                                }}
                            >
                                {/* Título idéntico al historial: Azul y negrita */}
                                <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
                                    <span className="font-bold text-blue-300 text-lg tracking-wide">{hoveredSlider.label}</span>
                                </div>

                                {/* Descripción idéntica al historial: Clara y fina */}
                                <div className="leading-snug text-slate-200 font-light text-[14px] text-left tracking-wide">
                                    {hoveredSlider.description}
                                </div>
                            </div>
                        )}

                    </div>

                    <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-3">
                        <button
                            onClick={saveToHistory}
                            disabled={!originalImage}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-slate-700 text-white font-bold rounded-lg shadow-lg transition flex justify-center items-center gap-2 btn-3d"
                        >
                            <i data-lucide="save" className="w-4 h-4"></i>
                            <span>GUARDAR Y REINICIAR IMAGEN</span>
                        </button>
                    </div>
                </aside>

                {/* CANVAS */}
                <section ref={canvasContainerRef} className="flex-1 canvas-container flex items-center justify-center relative overflow-hidden bg-slate-950">
                    {!originalImage && (
                        <div className="text-center p-12 border-2 border-dashed border-slate-700/50 rounded-2xl bg-slate-800/30 backdrop-blur-sm max-w-md mx-auto relative z-10 pointer-events-none">

                            <h3 className="text-lg font-medium text-slate-200 mb-1">Galería de Edición</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Sube imágenes, edítalas y guárdalas en el historial.
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
                        onMouseLeave={(e) => { handleMouseUp(); if (isColorPickerActive) setColorPickerPos({ x: -100, y: -100 }); }}
                        className={`max-w-full max-h-full object-contain shadow-2xl ring-1 ring-white/10 transition-opacity duration-300 ${!originalImage ? 'opacity-0 absolute' : 'opacity-100'
                            } ${isColorPickerActive ? 'cursor-none' : (isDragging ? 'cursor-grabbing' : 'cursor-grab')}`}
                    ></canvas>

                    {/* CURSOR CIRCULAR DEL COLOR PICKER */}
                    {isColorPickerActive && originalImage && (
                        <div
                            style={{
                                position: 'absolute',
                                left: colorPickerPos.x - 20,
                                top: colorPickerPos.y - 20,
                                width: 40, height: 40,
                                borderRadius: '50%',
                                border: '3px solid #fff',
                                boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(0,0,0,0.2)',
                                background: colorPickerColor,
                                pointerEvents: 'none',
                                zIndex: 60,
                                transition: 'background-color 0.05s ease'
                            }}
                        />
                    )}

                    {/* OVERLAY DE TEXTO INTERACTIVO */}
                    {isTextEditing && textOverlays.length > 0 && canvasContainerRef.current && (
                        <TextOverlayEditor
                            overlays={textOverlays}
                            setOverlays={setTextOverlays}
                            selectedIdx={selectedTextIdx}
                            setSelectedIdx={setSelectedTextIdx}
                            containerRef={canvasContainerRef}
                            onApply={applyTextOverlay}
                            onCancel={cancelTextOverlay}
                            onAdd={addNewTextOverlay}
                            onDelete={deleteTextOverlay}
                        />
                    )}



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
                            Historial de Ediciones
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                        {history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-600">
                                <i data-lucide="images" className="w-8 h-8 mb-2 opacity-20"></i>

                            </div>
                        ) : (
                            history.map((item, index) => (
                                <div
                                    key={item.id}
                                    onClick={() => restoreFromHistory(item)}
                                    onMouseEnter={() => setHoveredHistoryItem(item.id)}
                                    onMouseLeave={() => setHoveredHistoryItem(null)}
                                    className="group relative bg-slate-800 rounded-lg p-2 border border-slate-700/60 hover:border-blue-500 hover:bg-slate-750 transition-all duration-200 hover:shadow-md cursor-pointer glass-hover"
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
                                        <div className="glass-popup absolute bottom-1/2 right-0 mb-0 p-4 w-56 z-50 whitespace-normal">
                                            {/* Título idéntico al historial: Azul y negrita */}
                                            <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
                                                <span className="font-bold text-blue-300 text-lg tracking-wide">Efectos aplicados</span>
                                            </div>

                                            {/* Descripción idéntica al historial: Clara y fina */}
                                            <div className="leading-snug text-slate-200 font-light text-[14px] text-left tracking-wide">
                                                {item.effectsDescription}
                                            </div>
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
                onMouseEnter={() => onHover({ label, description })}
                onMouseLeave={() => onHover(null)}
                // --- NUEVO: Ocultar al hacer clic o tocar ---
                onMouseDown={() => onHover(null)}
                onTouchStart={() => onHover(null)}
                // -------------------------------------------
                className="w-full z-10 relative cursor-pointer"
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

// --- COMPONENTE: MODAL DE RECORTE ---
const CropModal = ({ imageSrc, onClose, onCrop }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [resizeHandle, setResizeHandle] = useState(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('free');
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const imageRef = useRef(null);
    const scaleRef = useRef(1);

    // Relaciones de aspecto predefinidas
    const aspectRatios = {
        'free': null,
        '1:1': 1,
        '16:9': 16 / 9,
        '9:16': 9 / 16,
        '4:3': 4 / 3,
        '3:2': 3 / 2,
        '21:9': 21 / 9
    };

    useEffect(() => {
        if (!imageSrc) return;

        const img = new Image();
        img.onload = () => {
            imageRef.current = img;
            setImageLoaded(true);

            // Calcular tamaño del canvas para que quepa en la pantalla
            const maxWidth = Math.min(window.innerWidth * 0.8, 900);
            const maxHeight = Math.min(window.innerHeight * 0.7, 600);

            let canvasWidth = img.width;
            let canvasHeight = img.height;

            const widthRatio = maxWidth / canvasWidth;
            const heightRatio = maxHeight / canvasHeight;
            scaleRef.current = Math.min(widthRatio, heightRatio, 1);

            canvasWidth *= scaleRef.current;
            canvasHeight *= scaleRef.current;

            setCanvasSize({ width: canvasWidth, height: canvasHeight });

            // Inicializar área de recorte al 80% del centro
            const initialCropWidth = canvasWidth * 0.8;
            const initialCropHeight = canvasHeight * 0.8;
            setCropArea({
                x: (canvasWidth - initialCropWidth) / 2,
                y: (canvasHeight - initialCropHeight) / 2,
                width: initialCropWidth,
                height: initialCropHeight
            });
        };
        img.src = imageSrc;
    }, [imageSrc]);

    useEffect(() => {
        if (!imageLoaded || !canvasRef.current) return;
        drawCanvas();
    }, [imageLoaded, cropArea, canvasSize]);

    const drawCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = imageRef.current;

        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Dibujar imagen escalada
        ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height);

        // Dibujar overlay oscuro
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Limpiar área de recorte (efecto de "ventana")
        ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);

        // Dibujar imagen en el área de recorte
        ctx.drawImage(
            img,
            cropArea.x / scaleRef.current,
            cropArea.y / scaleRef.current,
            cropArea.width / scaleRef.current,
            cropArea.height / scaleRef.current,
            cropArea.x,
            cropArea.y,
            cropArea.width,
            cropArea.height
        );

        // Dibujar borde del área de recorte
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);

        // Dibujar handles de redimensionamiento
        const handleSize = 10;
        const handles = [
            { x: cropArea.x - handleSize / 2, y: cropArea.y - handleSize / 2 }, // top-left
            { x: cropArea.x + cropArea.width / 2 - handleSize / 2, y: cropArea.y - handleSize / 2 }, // top-center
            { x: cropArea.x + cropArea.width - handleSize / 2, y: cropArea.y - handleSize / 2 }, // top-right
            { x: cropArea.x - handleSize / 2, y: cropArea.y + cropArea.height / 2 - handleSize / 2 }, // middle-left
            { x: cropArea.x + cropArea.width - handleSize / 2, y: cropArea.y + cropArea.height / 2 - handleSize / 2 }, // middle-right
            { x: cropArea.x - handleSize / 2, y: cropArea.y + cropArea.height - handleSize / 2 }, // bottom-left
            { x: cropArea.x + cropArea.width / 2 - handleSize / 2, y: cropArea.y + cropArea.height - handleSize / 2 }, // bottom-center
            { x: cropArea.x + cropArea.width - handleSize / 2, y: cropArea.y + cropArea.height - handleSize / 2 } // bottom-right
        ];

        ctx.fillStyle = '#38bdf8';
        handles.forEach(handle => {
            ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
        });

        // Dibujar líneas de la regla de tercios
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        // Líneas verticales
        ctx.beginPath();
        ctx.moveTo(cropArea.x + cropArea.width / 3, cropArea.y);
        ctx.lineTo(cropArea.x + cropArea.width / 3, cropArea.y + cropArea.height);
        ctx.moveTo(cropArea.x + 2 * cropArea.width / 3, cropArea.y);
        ctx.lineTo(cropArea.x + 2 * cropArea.width / 3, cropArea.y + cropArea.height);
        ctx.stroke();

        // Líneas horizontales
        ctx.beginPath();
        ctx.moveTo(cropArea.x, cropArea.y + cropArea.height / 3);
        ctx.lineTo(cropArea.x + cropArea.width, cropArea.y + cropArea.height / 3);
        ctx.moveTo(cropArea.x, cropArea.y + 2 * cropArea.height / 3);
        ctx.lineTo(cropArea.x + cropArea.width, cropArea.y + 2 * cropArea.height / 3);
        ctx.stroke();

        ctx.setLineDash([]);
    };

    const getMousePos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const getHandleAtPosition = (pos) => {
        const handleSize = 10;
        const handles = [
            { id: 'tl', x: cropArea.x - handleSize / 2, y: cropArea.y - handleSize / 2 },
            { id: 'tc', x: cropArea.x + cropArea.width / 2 - handleSize / 2, y: cropArea.y - handleSize / 2 },
            { id: 'tr', x: cropArea.x + cropArea.width - handleSize / 2, y: cropArea.y - handleSize / 2 },
            { id: 'ml', x: cropArea.x - handleSize / 2, y: cropArea.y + cropArea.height / 2 - handleSize / 2 },
            { id: 'mr', x: cropArea.x + cropArea.width - handleSize / 2, y: cropArea.y + cropArea.height / 2 - handleSize / 2 },
            { id: 'bl', x: cropArea.x - handleSize / 2, y: cropArea.y + cropArea.height - handleSize / 2 },
            { id: 'bc', x: cropArea.x + cropArea.width / 2 - handleSize / 2, y: cropArea.y + cropArea.height - handleSize / 2 },
            { id: 'br', x: cropArea.x + cropArea.width - handleSize / 2, y: cropArea.y + cropArea.height - handleSize / 2 }
        ];

        for (const handle of handles) {
            if (pos.x >= handle.x && pos.x <= handle.x + handleSize &&
                pos.y >= handle.y && pos.y <= handle.y + handleSize) {
                return handle.id;
            }
        }
        return null;
    };

    const handleMouseDown = (e) => {
        e.preventDefault();
        const pos = getMousePos(e);

        // Verificar si está haciendo clic en un handle
        const handle = getHandleAtPosition(pos);
        if (handle) {
            setIsResizing(true);
            setResizeHandle(handle);
            setDragStart({ x: pos.x, y: pos.y });
            return;
        }

        // Verificar si está dentro del área de recorte
        if (pos.x >= cropArea.x && pos.x <= cropArea.x + cropArea.width &&
            pos.y >= cropArea.y && pos.y <= cropArea.y + cropArea.height) {
            setIsDragging(true);
            setDragStart({ x: pos.x - cropArea.x, y: pos.y - cropArea.y });
        }
    };

    const handleMouseMove = (e) => {
        if (isResizing) {
            e.preventDefault();
            const pos = getMousePos(e);
            const dx = pos.x - dragStart.x;
            const dy = pos.y - dragStart.y;

            let newArea = { ...cropArea };
            const minSize = 50;

            switch (resizeHandle) {
                case 'br': // bottom-right
                    newArea.width = Math.max(minSize, Math.min(cropArea.width + dx, canvasSize.width - cropArea.x));
                    newArea.height = Math.max(minSize, Math.min(cropArea.height + dy, canvasSize.height - cropArea.y));
                    break;
                case 'bl': // bottom-left
                    newArea.width = Math.max(minSize, cropArea.width - dx);
                    newArea.height = Math.max(minSize, Math.min(cropArea.height + dy, canvasSize.height - cropArea.y));
                    if (newArea.width > minSize) newArea.x = cropArea.x + dx;
                    break;
                case 'tr': // top-right
                    newArea.width = Math.max(minSize, Math.min(cropArea.width + dx, canvasSize.width - cropArea.x));
                    newArea.height = Math.max(minSize, cropArea.height - dy);
                    if (newArea.height > minSize) newArea.y = cropArea.y + dy;
                    break;
                case 'tl': // top-left
                    newArea.width = Math.max(minSize, cropArea.width - dx);
                    newArea.height = Math.max(minSize, cropArea.height - dy);
                    if (newArea.width > minSize) newArea.x = cropArea.x + dx;
                    if (newArea.height > minSize) newArea.y = cropArea.y + dy;
                    break;
                case 'tc': // top-center
                    newArea.height = Math.max(minSize, cropArea.height - dy);
                    if (newArea.height > minSize) newArea.y = cropArea.y + dy;
                    break;
                case 'bc': // bottom-center
                    newArea.height = Math.max(minSize, Math.min(cropArea.height + dy, canvasSize.height - cropArea.y));
                    break;
                case 'ml': // middle-left
                    newArea.width = Math.max(minSize, cropArea.width - dx);
                    if (newArea.width > minSize) newArea.x = cropArea.x + dx;
                    break;
                case 'mr': // middle-right
                    newArea.width = Math.max(minSize, Math.min(cropArea.width + dx, canvasSize.width - cropArea.x));
                    break;
            }

            // Mantener dentro del canvas
            newArea.x = Math.max(0, Math.min(newArea.x, canvasSize.width - newArea.width));
            newArea.y = Math.max(0, Math.min(newArea.y, canvasSize.height - newArea.height));

            setCropArea(newArea);
            setDragStart({ x: pos.x, y: pos.y });
            return;
        }

        if (!isDragging) return;
        e.preventDefault();

        const pos = getMousePos(e);
        let newX = pos.x - dragStart.x;
        let newY = pos.y - dragStart.y;

        // Limitar al canvas
        newX = Math.max(0, Math.min(newX, canvasSize.width - cropArea.width));
        newY = Math.max(0, Math.min(newY, canvasSize.height - cropArea.height));

        setCropArea(prev => ({ ...prev, x: newX, y: newY }));
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
        setResizeHandle(null);
    };

    const handleCrop = () => {
        if (!imageRef.current) return;

        const img = imageRef.current;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calcular dimensiones originales
        const sourceX = cropArea.x / scaleRef.current;
        const sourceY = cropArea.y / scaleRef.current;
        const sourceWidth = cropArea.width / scaleRef.current;
        const sourceHeight = cropArea.height / scaleRef.current;

        canvas.width = sourceWidth;
        canvas.height = sourceHeight;

        ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, sourceWidth, sourceHeight
        );

        const croppedImage = canvas.toDataURL('image/jpeg', 0.95);
        onCrop(croppedImage);
        onClose();
    };

    const applyAspectRatio = (ratio) => {
        setAspectRatio(ratio);
        if (ratio === 'free' || !aspectRatios[ratio]) return;

        const targetRatio = aspectRatios[ratio];
        const currentWidth = cropArea.width;
        const currentHeight = cropArea.height;
        const currentRatio = currentWidth / currentHeight;

        let newWidth, newHeight;

        if (currentRatio > targetRatio) {
            // La imagen es más ancha que la relación objetivo
            newHeight = currentHeight;
            newWidth = currentHeight * targetRatio;
        } else {
            // La imagen es más alta que la relación objetivo
            newWidth = currentWidth;
            newHeight = currentWidth / targetRatio;
        }

        // Centrar el nuevo área de recorte
        const newX = cropArea.x + (currentWidth - newWidth) / 2;
        const newY = cropArea.y + (currentHeight - newHeight) / 2;

        setCropArea({
            x: Math.max(0, Math.min(newX, canvasSize.width - newWidth)),
            y: Math.max(0, Math.min(newY, canvasSize.height - newHeight)),
            width: newWidth,
            height: newHeight
        });
    };

    const resetCrop = () => {
        const initialCropWidth = canvasSize.width * 0.8;
        const initialCropHeight = canvasSize.height * 0.8;
        setCropArea({
            x: (canvasSize.width - initialCropWidth) / 2,
            y: (canvasSize.height - initialCropHeight) / 2,
            width: initialCropWidth,
            height: initialCropHeight
        });
        setAspectRatio('free');
    };

    if (!imageLoaded) {
        return (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="glass-modal w-full max-w-4xl p-8 rounded-2xl relative">
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-blue-500 animate-spin mb-4"></div>
                        <p className="text-white">Cargando imagen...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-modal w-full max-w-5xl max-h-[90vh] rounded-2xl relative flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <i data-lucide="crop" className="w-5 h-5 text-white"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Recortar Imagen</h2>
                            <p className="text-xs text-slate-400">Arrastra el área seleccionada para ajustar el recorte</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700/50 rounded-lg transition"
                    >
                        <i data-lucide="x" className="w-5 h-5 text-slate-400"></i>
                    </button>
                </div>

                {/* Contenido */}
                <div className="flex-1 overflow-auto p-6 flex flex-col items-center gap-6">
                    {/* Opciones de relación de aspecto */}
                    <div className="flex flex-wrap gap-2 justify-center">
                        {Object.keys(aspectRatios).map((ratio) => (
                            <button
                                key={ratio}
                                onClick={() => applyAspectRatio(ratio)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${aspectRatio === ratio
                                    ? 'bg-blue-600 border-blue-500 text-white'
                                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                                    }`}
                            >
                                {ratio === 'free' ? 'Libre' : ratio}
                            </button>
                        ))}
                    </div>

                    {/* Canvas de recorte */}
                    <div
                        ref={containerRef}
                        className="relative bg-slate-950 rounded-lg overflow-hidden shadow-2xl"
                        style={{ maxWidth: '100%' }}
                    >
                        <canvas
                            ref={canvasRef}
                            width={canvasSize.width}
                            height={canvasSize.height}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchStart={handleMouseDown}
                            onTouchMove={handleMouseMove}
                            onTouchEnd={handleMouseUp}
                            className={`${isDragging ? 'cursor-grabbing' : 'cursor-grab'} max-w-full h-auto`}
                        />
                    </div>

                    {/* Info del recorte */}
                    <div className="text-center text-sm text-slate-400">
                        <span className="text-slate-300 font-medium">
                            {Math.round(cropArea.width / scaleRef.current)} × {Math.round(cropArea.height / scaleRef.current)} px
                        </span>
                        <span className="mx-2">|</span>
                        <span>Relación: {(cropArea.width / cropArea.height).toFixed(2)}</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-700/50 flex items-center justify-between">
                    <button
                        onClick={resetCrop}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-600 transition"
                    >
                        <i data-lucide="rotate-ccw" className="w-4 h-4 inline mr-2"></i>
                        Restablecer
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-600 transition"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCrop}
                            className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium border border-emerald-500 transition flex items-center gap-2"
                        >
                            <i data-lucide="check" className="w-4 h-4"></i>
                            Aplicar Recorte
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE: MODAL DE REDIMENSIONAR ---
const ResizeModal = ({ imageSrc, onClose, onResize }) => {
    const [width, setWidth] = useState(800);
    const [height, setHeight] = useState(600);
    const [maintainAspect, setMaintainAspect] = useState(true);
    const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (imageSrc) {
            const img = new Image();
            img.onload = () => {
                setOriginalSize({ width: img.width, height: img.height });
                setWidth(img.width);
                setHeight(img.height);
            };
            img.src = imageSrc;
        }
    }, [imageSrc]);

    const handleWidthChange = (e) => {
        const newWidth = parseInt(e.target.value) || 0;
        setWidth(newWidth);
        if (maintainAspect && originalSize.width > 0) {
            const ratio = originalSize.height / originalSize.width;
            setHeight(Math.round(newWidth * ratio));
        }
    };

    const handleHeightChange = (e) => {
        const newHeight = parseInt(e.target.value) || 0;
        setHeight(newHeight);
        if (maintainAspect && originalSize.height > 0) {
            const ratio = originalSize.width / originalSize.height;
            setWidth(Math.round(newHeight * ratio));
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-modal w-full max-w-md rounded-2xl relative overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700/50">
                    <h2 className="text-xl font-bold text-white">Redimensionar Imagen</h2>
                    <p className="text-xs text-slate-400 mt-1">Original: {originalSize.width} × {originalSize.height} px</p>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-400 block mb-2">Ancho (px)</label>
                            <input
                                type="number"
                                value={width}
                                onChange={handleWidthChange}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                                min="1"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-2">Alto (px)</label>
                            <input
                                type="number"
                                value={height}
                                onChange={handleHeightChange}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                                min="1"
                            />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={maintainAspect}
                            onChange={(e) => setMaintainAspect(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600"
                        />
                        <span className="text-sm text-slate-300">Mantener proporción</span>
                    </label>
                </div>
                <div className="px-6 py-4 border-t border-slate-700/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm">Cancelar</button>
                    <button onClick={() => { onResize(width, height); onClose(); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">Aplicar</button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE: MODAL DE ROTACIÓN LIBRE ---
const RotateModal = ({ onClose, onRotate }) => {
    const [angle, setAngle] = useState(0);

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-modal w-full max-w-sm rounded-2xl relative overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700/50">
                    <h2 className="text-xl font-bold text-white">Rotar Imagen</h2>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-xs text-slate-400 block mb-2">Ángulo: {angle}°</label>
                        <input
                            type="range"
                            min="-180"
                            max="180"
                            value={angle}
                            onChange={(e) => setAngle(parseInt(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>-180°</span>
                            <span>0°</span>
                            <span>+180°</span>
                        </div>
                    </div>
                    <input
                        type="number"
                        value={angle}
                        onChange={(e) => setAngle(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm text-center"
                    />
                </div>
                <div className="px-6 py-4 border-t border-slate-700/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm">Cancelar</button>
                    <button onClick={() => { onRotate(angle); onClose(); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">Aplicar</button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE: MODAL DE MARCO ---
const BorderModal = ({ onClose, onAddBorder }) => {
    const [borderWidth, setBorderWidth] = useState(20);
    const [borderColor, setBorderColor] = useState('#ffffff');

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-modal w-full max-w-sm rounded-2xl relative overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700/50">
                    <h2 className="text-xl font-bold text-white">Añadir Marco</h2>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-xs text-slate-400 block mb-2">Ancho del marco: {borderWidth}px</label>
                        <input
                            type="range"
                            min="5"
                            max="100"
                            value={borderWidth}
                            onChange={(e) => setBorderWidth(parseInt(e.target.value))}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-2">Color</label>
                        <div className="flex gap-2 flex-wrap">
                            {['#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'].map(color => (
                                <button
                                    key={color}
                                    onClick={() => setBorderColor(color)}
                                    className={`w-8 h-8 rounded-lg border-2 ${borderColor === color ? 'border-white' : 'border-transparent'}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                        <input
                            type="color"
                            value={borderColor}
                            onChange={(e) => setBorderColor(e.target.value)}
                            className="w-full mt-2 h-10 rounded cursor-pointer"
                        />
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-700/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm">Cancelar</button>
                    <button onClick={() => { onAddBorder(borderWidth, borderColor); onClose(); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">Aplicar</button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE: MODAL DE TEXTO ---
const TextOverlayEditor = ({ overlays, setOverlays, selectedIdx, setSelectedIdx, containerRef, onApply, onCancel, onAdd, onDelete }) => {
    const [dragState, setDragState] = useState(null);
    const FONTS = ['Arial', 'Georgia', 'Courier New', 'Impact', 'Verdana', 'Times New Roman', 'Comic Sans MS', 'Trebuchet MS'];
    const HANDLE_SIZE = 10;

    const selected = selectedIdx >= 0 && selectedIdx < overlays.length ? overlays[selectedIdx] : null;

    const updateOverlay = (idx, updates) => {
        setOverlays(prev => prev.map((o, i) => i === idx ? { ...o, ...updates } : o));
    };

    const handleMouseDown = (e, type, handle = null) => {
        e.preventDefault();
        e.stopPropagation();
        if (selectedIdx < 0) return;
        setDragState({
            type, handle,
            startX: e.clientX, startY: e.clientY,
            startOverlay: { ...overlays[selectedIdx] }
        });
    };

    useEffect(() => {
        if (!dragState || selectedIdx < 0) return;
        const container = containerRef.current;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();

        const handleMouseMove = (e) => {
            const dx = ((e.clientX - dragState.startX) / containerRect.width) * 100;
            const dy = ((e.clientY - dragState.startY) / containerRect.height) * 100;
            const s = dragState.startOverlay;

            if (dragState.type === 'move') {
                updateOverlay(selectedIdx, {
                    x: Math.max(0, Math.min(100 - s.width, s.x + dx)),
                    y: Math.max(0, Math.min(100 - s.height, s.y + dy))
                });
            } else if (dragState.type === 'resize') {
                const h = dragState.handle;
                let newX = s.x, newY = s.y, newW = s.width, newH = s.height;
                const MIN = 5;
                if (h.includes('l')) { newX = s.x + dx; newW = s.width - dx; }
                if (h.includes('r')) { newW = s.width + dx; }
                if (h.includes('t')) { newY = s.y + dy; newH = s.height - dy; }
                if (h.includes('b')) { newH = s.height + dy; }
                if (newW >= MIN && newH >= MIN) {
                    updateOverlay(selectedIdx, {
                        x: Math.max(0, newX), y: Math.max(0, newY),
                        width: Math.min(100, newW), height: Math.min(100, newH)
                    });
                }
            }
        };
        const handleMouseUp = () => setDragState(null);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, selectedIdx]);

    const handles = [
        { id: 'tl', cursor: 'nwse-resize', style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
        { id: 'tc', cursor: 'ns-resize', style: { top: -HANDLE_SIZE / 2, left: '50%', marginLeft: -HANDLE_SIZE / 2 } },
        { id: 'tr', cursor: 'nesw-resize', style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
        { id: 'ml', cursor: 'ew-resize', style: { top: '50%', marginTop: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
        { id: 'mr', cursor: 'ew-resize', style: { top: '50%', marginTop: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
        { id: 'bl', cursor: 'nesw-resize', style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
        { id: 'bc', cursor: 'ns-resize', style: { bottom: -HANDLE_SIZE / 2, left: '50%', marginLeft: -HANDLE_SIZE / 2 } },
        { id: 'br', cursor: 'nwse-resize', style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
    ];
    const handleDir = { tl: 'tl', tc: 't', tr: 'tr', ml: 'l', mr: 'r', bl: 'bl', bc: 'b', br: 'br' };

    return (
        <>
            {/* Render ALL text overlays */}
            {overlays.map((ov, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                    <div
                        key={idx}
                        style={{
                            position: 'absolute',
                            left: `${ov.x}%`, top: `${ov.y}%`,
                            width: `${ov.width}%`, height: `${ov.height}%`,
                            zIndex: isSelected ? 50 : 40,
                            cursor: isSelected ? (dragState?.type === 'move' ? 'grabbing' : 'grab') : 'pointer',
                            userSelect: 'none'
                        }}
                        onMouseDown={(e) => {
                            if (isSelected) {
                                handleMouseDown(e, 'move');
                            } else {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedIdx(idx);
                            }
                        }}
                    >
                        {/* Border */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            border: isSelected ? '2px dashed rgba(59, 130, 246, 0.9)' : '1px dashed rgba(148, 163, 184, 0.5)',
                            borderRadius: 4,
                            background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                        }} />

                        {/* Text preview */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 8, overflow: 'hidden',
                            fontFamily: ov.fontFamily,
                            fontSize: `${ov.fontSize}px`,
                            fontWeight: 'bold',
                            color: ov.color,
                            textShadow: '2px 2px 4px rgba(0,0,0,0.6)',
                            textAlign: 'center',
                            wordBreak: 'break-word',
                            lineHeight: 1.2,
                            pointerEvents: 'none'
                        }}>
                            {ov.text}
                        </div>

                        {/* Index badge */}
                        <div style={{
                            position: 'absolute', top: -8, left: -8,
                            width: 18, height: 18, borderRadius: '50%',
                            background: isSelected ? '#3b82f6' : '#64748b',
                            color: '#fff', fontSize: 9, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '2px solid #fff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                            pointerEvents: 'none'
                        }}>
                            {idx + 1}
                        </div>

                        {/* 8 resize handles (only on selected) */}
                        {isSelected && handles.map(h => (
                            <div
                                key={h.id}
                                style={{
                                    position: 'absolute',
                                    width: HANDLE_SIZE, height: HANDLE_SIZE,
                                    background: '#3b82f6',
                                    border: '2px solid #fff',
                                    borderRadius: '50%',
                                    cursor: h.cursor, zIndex: 51,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                                    ...h.style
                                }}
                                onMouseDown={(e) => handleMouseDown(e, 'resize', handleDir[h.id])}
                            />
                        ))}
                    </div>
                );
            })}

            {/* Floating toolbar */}
            <div style={{
                position: 'absolute',
                bottom: 12, left: '50%', transform: 'translateX(-50%)',
                zIndex: 55,
                display: 'flex', gap: 6, alignItems: 'center',
                padding: '6px 10px',
                background: 'rgba(15, 23, 42, 0.95)',
                borderRadius: 12,
                border: '1px solid rgba(100, 116, 139, 0.4)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                flexWrap: 'wrap', justifyContent: 'center', maxWidth: '90%'
            }}>
                {selected ? (
                    <>
                        {/* Font family */}
                        <select
                            value={selected.fontFamily}
                            onChange={(e) => updateOverlay(selectedIdx, { fontFamily: e.target.value })}
                            style={{
                                background: '#1e293b', color: '#e2e8f0', border: '1px solid #475569',
                                borderRadius: 6, padding: '4px 6px', fontSize: 11, outline: 'none', cursor: 'pointer'
                            }}
                        >
                            {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                        </select>

                        {/* Font size */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>Tam</span>
                            <input
                                type="range" min="12" max="120"
                                value={selected.fontSize}
                                onChange={(e) => updateOverlay(selectedIdx, { fontSize: parseInt(e.target.value) })}
                                style={{ width: 60, accentColor: '#3b82f6' }}
                            />
                            <span style={{ fontSize: 10, color: '#cbd5e1', minWidth: 20 }}>{selected.fontSize}</span>
                        </div>

                        {/* Color */}
                        <input
                            type="color" value={selected.color}
                            onChange={(e) => updateOverlay(selectedIdx, { color: e.target.value })}
                            style={{ width: 26, height: 26, border: '1px solid #475569', borderRadius: 6, cursor: 'pointer', padding: 1, background: 'transparent' }}
                        />

                        {/* Edit text - campo de texto inline editable */}
                        <input
                            type="text"
                            value={selected.text}
                            onChange={(e) => updateOverlay(selectedIdx, { text: e.target.value })}
                            placeholder="Escribe tu texto..."
                            style={{
                                background: '#1e293b', color: '#e2e8f0', border: '1px solid #475569',
                                borderRadius: 6, padding: '4px 8px', fontSize: 11,
                                outline: 'none', width: 120, minWidth: 80
                            }}
                        />

                        {/* Delete this text */}
                        <button
                            onClick={() => onDelete(selectedIdx)}
                            title="Eliminar este texto"
                            style={{
                                background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b',
                                borderRadius: 6, padding: '4px 7px', fontSize: 11, cursor: 'pointer'
                            }}
                        >🗑</button>

                        <div style={{ width: 1, height: 20, background: '#475569' }} />
                    </>
                ) : (
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Haz clic en un texto para editarlo</span>
                )}

                {/* Add another text */}
                <button
                    onClick={onAdd}
                    title="Añadir otro texto"
                    style={{
                        background: '#1e40af', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                    }}
                >+ Texto</button>

                {/* Apply all */}
                <button
                    onClick={onApply}
                    style={{
                        background: '#16a34a', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                    }}
                >✓ Aplicar todo</button>

                {/* Cancel */}
                <button
                    onClick={onCancel}
                    style={{
                        background: '#dc2626', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '5px 7px', fontSize: 11, cursor: 'pointer'
                    }}
                >✕</button>
            </div>
        </>
    );
};




// --- COMPONENTE: EDITOR DE FORMAS ---
const ShapeOverlayEditor = ({ overlays, setOverlays, selectedIdx, setSelectedIdx, containerRef, onApply, onCancel, onAdd, onDelete }) => {
    const [dragState, setDragState] = useState(null);
    const HANDLE_SIZE = 10;

    const selected = selectedIdx >= 0 && selectedIdx < overlays.length ? overlays[selectedIdx] : null;

    const updateOverlay = (idx, updates) => {
        setOverlays(prev => prev.map((o, i) => i === idx ? { ...o, ...updates } : o));
    };

    const handleMouseDown = (e, type, handle = null) => {
        e.preventDefault();
        e.stopPropagation();
        if (selectedIdx < 0) return;
        setDragState({
            type, handle,
            startX: e.clientX, startY: e.clientY,
            startOverlay: { ...overlays[selectedIdx] }
        });
    };

    useEffect(() => {
        if (!dragState || selectedIdx < 0) return;
        const container = containerRef.current;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();

        const handleMouseMove = (e) => {
            const dx = ((e.clientX - dragState.startX) / containerRect.width) * 100;
            const dy = ((e.clientY - dragState.startY) / containerRect.height) * 100;
            const s = dragState.startOverlay;

            if (dragState.type === 'move') {
                updateOverlay(selectedIdx, {
                    x: Math.max(0, Math.min(100 - s.width, s.x + dx)),
                    y: Math.max(0, Math.min(100 - s.height, s.y + dy))
                });
            } else if (dragState.type === 'resize') {
                const h = dragState.handle;
                let newX = s.x, newY = s.y, newW = s.width, newH = s.height;
                const MIN = 5;
                if (h.includes('l')) { newX = s.x + dx; newW = s.width - dx; }
                if (h.includes('r')) { newW = s.width + dx; }
                if (h.includes('t')) { newY = s.y + dy; newH = s.height - dy; }
                if (h.includes('b')) { newH = s.height + dy; }
                if (newW >= MIN && newH >= MIN) {
                    updateOverlay(selectedIdx, {
                        x: Math.max(0, newX), y: Math.max(0, newY),
                        width: Math.min(100, newW), height: Math.min(100, newH)
                    });
                }
            }
        };
        const handleMouseUp = () => setDragState(null);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, selectedIdx]);

    const handles = [
        { id: 'tl', cursor: 'nwse-resize', style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
        { id: 'tc', cursor: 'ns-resize', style: { top: -HANDLE_SIZE / 2, left: '50%', marginLeft: -HANDLE_SIZE / 2 } },
        { id: 'tr', cursor: 'nesw-resize', style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
        { id: 'ml', cursor: 'ew-resize', style: { top: '50%', marginTop: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
        { id: 'mr', cursor: 'ew-resize', style: { top: '50%', marginTop: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
        { id: 'bl', cursor: 'nesw-resize', style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
        { id: 'bc', cursor: 'ns-resize', style: { bottom: -HANDLE_SIZE / 2, left: '50%', marginLeft: -HANDLE_SIZE / 2 } },
        { id: 'br', cursor: 'nwse-resize', style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
    ];
    const handleDir = { tl: 'tl', tc: 't', tr: 'tr', ml: 'l', mr: 'r', bl: 'bl', bc: 'b', br: 'br' };

    return (
        <>
            {/* Render shapes */}
            {overlays.map((ov, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                    <div
                        key={idx}
                        style={{
                            position: 'absolute',
                            left: `${ov.x}%`, top: `${ov.y}%`,
                            width: `${ov.width}%`, height: `${ov.height}%`,
                            zIndex: isSelected ? 50 : 40,
                            cursor: isSelected ? (dragState?.type === 'move' ? 'grabbing' : 'grab') : 'pointer',
                            userSelect: 'none'
                        }}
                        onMouseDown={(e) => {
                            if (isSelected) {
                                handleMouseDown(e, 'move');
                            } else {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedIdx(idx);
                            }
                        }}
                    >
                        {/* Shape rendering */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            border: `2px solid ${ov.color}`,
                            background: ov.filled ? ov.color : 'transparent',
                            borderRadius: ov.type === 'circle' ? '50%' : '0%',
                            boxSizing: 'border-box'
                        }} />

                        {/* Selection Border */}
                        {isSelected && (
                            <div style={{
                                position: 'absolute', inset: -4,
                                border: '1px dashed rgba(59, 130, 246, 0.8)',
                                borderRadius: ov.type === 'circle' ? '50%' : 4,
                                pointerEvents: 'none'
                            }} />
                        )}

                        {/* Index badge */}
                        <div style={{
                            position: 'absolute', top: -12, left: -12,
                            width: 18, height: 18, borderRadius: '50%',
                            background: isSelected ? '#3b82f6' : '#64748b',
                            color: '#fff', fontSize: 9, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '2px solid #fff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                            pointerEvents: 'none'
                        }}>
                            {idx + 1}
                        </div>

                        {/* 8 resize handles (only on selected) */}
                        {isSelected && handles.map(h => (
                            <div
                                key={h.id}
                                style={{
                                    position: 'absolute',
                                    width: HANDLE_SIZE, height: HANDLE_SIZE,
                                    background: '#3b82f6',
                                    border: '2px solid #fff',
                                    borderRadius: '50%',
                                    cursor: h.cursor, zIndex: 51,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                                    ...h.style
                                }}
                                onMouseDown={(e) => handleMouseDown(e, 'resize', handleDir[h.id])}
                            />
                        ))}
                    </div>
                );
            })}

            {/* Floating toolbar */}
            <div style={{
                position: 'absolute',
                bottom: 12, left: '50%', transform: 'translateX(-50%)',
                zIndex: 55,
                display: 'flex', gap: 6, alignItems: 'center',
                padding: '6px 10px',
                background: 'rgba(15, 23, 42, 0.95)',
                borderRadius: 12,
                border: '1px solid rgba(100, 116, 139, 0.4)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                flexWrap: 'wrap', justifyContent: 'center', maxWidth: '90%'
            }}>
                <button title="Rectángulo" onClick={() => onAdd('rect')} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs border border-slate-600 font-bold">⬜</button>
                <button title="Círculo" onClick={() => onAdd('circle')} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs border border-slate-600 font-bold">⚪</button>

                <div className="w-[1px] h-6 bg-slate-700 mx-1"></div>

                {selected ? (
                    <>
                        <input
                            type="color" value={selected.color}
                            onChange={(e) => updateOverlay(selectedIdx, { color: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer bg-transparent border border-slate-600 p-0.5"
                        />
                        <label className="flex items-center gap-1 text-[10px] text-slate-300 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={selected.filled}
                                onChange={(e) => updateOverlay(selectedIdx, { filled: e.target.checked })}
                                className="w-3 h-3 rounded border-slate-600"
                            />
                            Relleno
                        </label>

                        <div className="w-[1px] h-6 bg-slate-700 mx-1"></div>

                        <button
                            onClick={() => onDelete(selectedIdx)}
                            title="Eliminar forma"
                            style={{
                                background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b',
                                borderRadius: 6, padding: '4px 7px', fontSize: 11, cursor: 'pointer'
                            }}
                        >🗑</button>
                    </>
                ) : (
                    <span className="text-[10px] text-slate-400">Selecciona una forma</span>
                )}

                <div className="w-[1px] h-6 bg-slate-700 mx-1"></div>

                {/* Apply all */}
                <button
                    onClick={onApply}
                    style={{
                        background: '#16a34a', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                    }}
                >✓ Aplicar</button>

                {/* Cancel */}
                <button
                    onClick={onCancel}
                    style={{
                        background: '#dc2626', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '5px 7px', fontSize: 11, cursor: 'pointer'
                    }}
                >✕</button>
            </div>
        </>
    );
};



// --- COMPONENTE: MODAL DE PERSPECTIVA (Keystone) ---
const PerspectiveModal = ({ imageSrc, onClose, onApply }) => {
    const [vertical, setVertical] = useState(0); // -50 to 50
    const [horizontal, setHorizontal] = useState(0); // -50 to 50
    const [previewUrl, setPreviewUrl] = useState(null);

    useEffect(() => {
        if (imageSrc) {
            updatePreview();
        }
    }, [imageSrc, vertical, horizontal]);

    const updatePreview = () => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            // Simple preview using transform (not real perspective but close for small adjustments)
            // Real perspective needs webgl or complex slicing. 
            // We implementation simple Keystone by slicing image into strips.

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (vertical !== 0) {
                // Vertical Keystone
                const strips = 50;
                const h = img.height / strips;
                for (let i = 0; i < strips; i++) {
                    const y = i * h;
                    // Calculate width scaling factor based on y
                    // If vertical > 0 (bottom smaller), scale factor decreases as y increases? 
                    // Let's say vertical 50 => bottom width is 50%.
                    // If vertical < 0 (top smaller), top width is 50%.

                    let scale = 1;
                    const progress = i / strips;

                    if (vertical > 0) {
                        // Bottom smaller
                        scale = 1 - (progress * (vertical / 100));
                    } else {
                        // Top smaller
                        scale = 1 - ((1 - progress) * (-vertical / 100));
                    }

                    const w = img.width * scale;
                    const x = (img.width - w) / 2;

                    ctx.drawImage(img, 0, y, img.width, h, x, y, w, h);
                }
            } else if (horizontal !== 0) {
                // Horizontal Keystone
                const strips = 50;
                const w = img.width / strips;
                for (let i = 0; i < strips; i++) {
                    const x = i * w;
                    let scale = 1;
                    const progress = i / strips;

                    if (horizontal > 0) {
                        // Right smaller
                        scale = 1 - (progress * (horizontal / 100));
                    } else {
                        // Left smaller
                        scale = 1 - ((1 - progress) * (-horizontal / 100));
                    }

                    const h = img.height * scale;
                    const y = (img.height - h) / 2;

                    ctx.drawImage(img, x, 0, w, img.height, x, y, w, h);
                }
            } else {
                ctx.drawImage(img, 0, 0);
            }

            setPreviewUrl(canvas.toDataURL());
        };
        img.src = imageSrc;
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-modal w-full max-w-lg rounded-2xl relative overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700/50">
                    <h2 className="text-xl font-bold text-white">Perspectiva (Keystone)</h2>
                </div>
                <div className="p-6 space-y-6">
                    <div className="bg-slate-950 rounded border border-slate-800 h-64 flex items-center justify-center overflow-hidden">
                        {previewUrl && <img src={previewUrl} className="max-h-full object-contain" />}
                    </div>

                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-xs text-slate-400">Vertical</label>
                            <span className="text-xs text-blue-400">{vertical}</span>
                        </div>
                        <input type="range" min="-50" max="50" value={vertical} onChange={e => { setVertical(parseInt(e.target.value)); setHorizontal(0); }} className="w-full" />
                    </div>
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-xs text-slate-400">Horizontal</label>
                            <span className="text-xs text-blue-400">{horizontal}</span>
                        </div>
                        <input type="range" min="-50" max="50" value={horizontal} onChange={e => { setHorizontal(parseInt(e.target.value)); setVertical(0); }} className="w-full" />
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-700/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm">Cancelar</button>
                    <button onClick={() => { onApply(previewUrl); onClose(); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">Aplicar</button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE: MODAL DE CURVAS (con vista previa en tiempo real) ---
const CurvesModal = ({ imageSrc, onClose, onApply }) => {
    // Puntos de control de la curva en coordenadas de canvas (0,0 arriba-izq, 255,255 abajo-der)
    // Un punto (x, y) significa: entrada x → salida (255 - y) (porque el eje Y del canvas está invertido)
    const [points, setPoints] = useState([{ x: 0, y: 255 }, { x: 255, y: 0 }]);

    const graphCanvasRef = useRef(null);
    const [dragIdx, setDragIdx] = useState(-1);
    const [previewUrl, setPreviewUrl] = useState(null);
    const originalImageDataRef = useRef(null); // Cache de datos originales para rendimiento

    // Cargar y cachear los datos de la imagen original al montar
    useEffect(() => {
        if (!imageSrc) return;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            originalImageDataRef.current = {
                width: img.width,
                height: img.height,
                data: ctx.getImageData(0, 0, img.width, img.height)
            };
            setPreviewUrl(imageSrc); // Preview inicial = imagen sin cambios
        };
        img.src = imageSrc;
    }, [imageSrc]);

    // Genera la LUT (Look-Up Table) a partir de los puntos de control
    const generateLUT = (pts) => {
        const lut = new Uint8Array(256);
        const sorted = [...pts].sort((a, b) => a.x - b.x);
        for (let i = 0; i < 256; i++) {
            if (i <= sorted[0].x) {
                lut[i] = Math.max(0, Math.min(255, 255 - sorted[0].y));
            } else if (i >= sorted[sorted.length - 1].x) {
                lut[i] = Math.max(0, Math.min(255, 255 - sorted[sorted.length - 1].y));
            } else {
                const idx = sorted.findIndex(p => p.x >= i);
                const p1 = sorted[idx - 1];
                const p2 = sorted[idx];
                const t = (p2.x - p1.x) === 0 ? 0 : (i - p1.x) / (p2.x - p1.x);
                const val = p1.y + (p2.y - p1.y) * t;
                lut[i] = Math.max(0, Math.min(255, 255 - val));
            }
        }
        return lut;
    };

    // Actualiza la vista previa de la imagen en tiempo real cuando cambian los puntos
    useEffect(() => {
        drawGraph();
        if (!originalImageDataRef.current) return;

        const lut = generateLUT(points);
        const { width, height, data: origData } = originalImageDataRef.current;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Copia profunda de los datos originales para no mutarlos
        const newImageData = ctx.createImageData(width, height);
        const src = origData.data;
        const dst = newImageData.data;

        for (let i = 0; i < src.length; i += 4) {
            dst[i] = lut[src[i]];     // R
            dst[i + 1] = lut[src[i + 1]]; // G
            dst[i + 2] = lut[src[i + 2]]; // B
            dst[i + 3] = src[i + 3];      // A
        }
        ctx.putImageData(newImageData, 0, 0);
        setPreviewUrl(canvas.toDataURL('image/jpeg', 0.85));
    }, [points]);

    // Dibuja el gráfico de la curva
    const drawGraph = () => {
        const canvas = graphCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 256);

        // Línea diagonal de referencia (sin curva = sin cambio)
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, 255);
        ctx.lineTo(255, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        // Rejilla
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 4; i++) {
            ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256);
            ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64);
        }
        ctx.stroke();

        // Curva (interpolación lineal entre puntos ordenados)
        const sorted = [...points].sort((a, b) => a.x - b.x);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sorted[0].x, sorted[0].y);
        for (let i = 1; i < sorted.length; i++) {
            ctx.lineTo(sorted[i].x, sorted[i].y);
        }
        ctx.stroke();

        // Puntos de control
        sorted.forEach((p, i) => {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    };

    // Eventos de ratón para el gráfico de curvas
    const handleGraphMouseDown = (e) => {
        const rect = graphCanvasRef.current.getBoundingClientRect();
        const scaleX = 256 / rect.width;
        const scaleY = 256 / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        const hit = points.findIndex(p => Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2) < 15);
        if (hit >= 0) {
            setDragIdx(hit);
        } else if (points.length < 10) {
            setPoints(prev => [...prev, { x: Math.round(x), y: Math.round(y) }]);
            setDragIdx(points.length);
        }
    };

    const handleGraphMouseMove = (e) => {
        if (dragIdx < 0) return;
        const rect = graphCanvasRef.current.getBoundingClientRect();
        const scaleX = 256 / rect.width;
        const scaleY = 256 / rect.height;
        const x = Math.max(0, Math.min(255, Math.round((e.clientX - rect.left) * scaleX)));
        const y = Math.max(0, Math.min(255, Math.round((e.clientY - rect.top) * scaleY)));
        setPoints(prev => {
            const newPts = [...prev];
            newPts[dragIdx] = { x, y };
            return newPts;
        });
    };

    // Aceptar: aplica la curva final a la imagen
    const handleAccept = () => {
        if (previewUrl) {
            onApply(previewUrl);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-modal w-full max-w-3xl rounded-2xl relative overflow-hidden" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="px-6 py-4 border-b border-slate-700/50 shrink-0">
                    <h2 className="text-xl font-bold text-white">Curvas de Tono</h2>
                    <p className="text-xs text-slate-400 mt-1">Arrastra los puntos de la curva. Los cambios se reflejan al instante.</p>
                </div>
                <div className="p-6 flex flex-col gap-4 bg-slate-900 overflow-auto" style={{ flex: 1 }}>
                    {/* Fila superior: Gráfico de curva (compacto) */}
                    <div className="flex flex-col items-center gap-1">
                        <div className="relative w-[200px] h-[200px] bg-black border border-slate-700 cursor-crosshair rounded">
                            <canvas
                                ref={graphCanvasRef}
                                width={256} height={256}
                                onMouseDown={handleGraphMouseDown}
                                onMouseMove={handleGraphMouseMove}
                                onMouseUp={() => setDragIdx(-1)}
                                onMouseLeave={() => setDragIdx(-1)}
                                style={{ display: 'block', width: '100%', height: '100%' }}
                            />
                        </div>
                        <div className="flex justify-between w-[200px] text-[9px] text-slate-500">
                            <span>Sombras</span>
                            <span>Medios tonos</span>
                            <span>Luces</span>
                        </div>
                    </div>

                    {/* Vista previa de la imagen (grande) */}
                    <div className="flex flex-col items-center gap-1" style={{ flex: 1, minHeight: 0 }}>
                        <div className="bg-slate-950 rounded border border-slate-800 w-full flex items-center justify-center overflow-hidden" style={{ height: '45vh', minHeight: 250 }}>
                            {previewUrl ? (
                                <img src={previewUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="Preview" />
                            ) : (
                                <span className="text-slate-500 text-xs">Cargando imagen...</span>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-400">Vista previa en tiempo real</span>
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-700/50 flex justify-between items-center bg-slate-900">
                    <button
                        onClick={() => setPoints([{ x: 0, y: 255 }, { x: 255, y: 0 }])}
                        className="text-xs text-slate-500 hover:text-white transition"
                    >Resetear</button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition">Cancelar</button>
                        <button onClick={handleAccept} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition font-medium">Aceptar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE: MODAL DE EXPORTACIÓN ---
const ExportModal = ({ imageSrc, onClose, onExport }) => {
    const [format, setFormat] = useState('image/jpeg');
    const [quality, setQuality] = useState(0.9);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [fileSize, setFileSize] = useState(null);

    useEffect(() => {
        if (imageSrc) {
            generatePreview();
        }
    }, [imageSrc, format, quality]);

    const generatePreview = () => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const url = canvas.toDataURL(format, parseFloat(quality));
            setPreviewUrl(url);

            // Estimate size
            const head = 'data:' + format + ';base64,';
            const size = Math.round((url.length - head.length) * 3 / 4);
            setFileSize((size / 1024).toFixed(1) + ' KB');
        };
        img.src = imageSrc;
    };

    const handleDownload = () => {
        if (!previewUrl) return;
        const link = document.createElement('a');
        const ext = format.split('/')[1];
        link.download = `editado-${Date.now()}.${ext}`;
        link.href = previewUrl;
        link.click();
        onExport();
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-modal w-full max-w-2xl rounded-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-700/50">
                    <h2 className="text-xl font-bold text-white">Exportar Imagen</h2>
                </div>

                <div className="flex-1 overflow-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-4">
                        <div className="bg-slate-950 rounded-lg p-2 border border-slate-800 flex items-center justify-center min-h-[200px]">
                            {previewUrl ? (
                                <img src={previewUrl} className="max-w-full max-h-[300px] object-contain" alt="Preview" />
                            ) : (
                                <div className="text-slate-500">Generando vista previa...</div>
                            )}
                        </div>
                        <div className="text-center">
                            <span className="text-slate-300 font-medium">{fileSize}</span>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="text-sm font-medium text-slate-300 block mb-2">Formato</label>
                            <div className="flex gap-2">
                                {['image/jpeg', 'image/png', 'image/webp'].map(fmt => (
                                    <button
                                        key={fmt}
                                        onClick={() => setFormat(fmt)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${format === fmt
                                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/50'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                            }`}
                                    >
                                        {fmt.split('/')[1].toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium text-slate-300">Calidad (Compresión)</label>
                                <span className="text-xs text-blue-400 font-bold">{Math.round(quality * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0.1"
                                max="1"
                                step="0.05"
                                value={quality}
                                onChange={(e) => setQuality(parseFloat(e.target.value))}
                                className="w-full"
                                disabled={format === 'image/png'} // PNG is lossless usually, but canvas supports quality for some browsers. Standard PNG doesn't use quality param in toDataURL per spec, but some do. Safest to disable or ignore.
                            />
                            {format === 'image/png' && <p className="text-[10px] text-slate-500 mt-1">PNG no soporta ajuste de calidad (lossless).</p>}
                        </div>

                        <div className="pt-4 border-t border-slate-700/50">
                            <button
                                onClick={handleDownload}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/50 transition flex items-center justify-center gap-2"
                            >
                                <i data-lucide="download" className="w-4 h-4"></i>
                                Descargar
                            </button>
                            <button
                                onClick={onClose}
                                className="w-full mt-3 py-2 bg-transparent hover:bg-slate-800 text-slate-400 font-medium rounded-lg border border-slate-700 transition"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);