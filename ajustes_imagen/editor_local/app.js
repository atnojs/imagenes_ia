const { useState, useRef, useEffect, useCallback } = React;

// --- CONFIGURACIÓN CONSTANTES ---
const DB_NAME = 'editor_local_db';
const DB_VERSION = 1;
const STORE_NAME = 'history';

let db = null;

const openDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
    };
});

const loadHistoryFromDb = async () => {
    try {
        if (!db) await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
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

const saveHistoryItemToDb = async (item) => {
    try {
        if (!db) await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(item);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) { console.warn('Error guardando item:', e); }
};

const deleteHistoryItemFromDb = async (id) => {
    try {
        if (!db) await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) { console.warn('Error eliminando item:', e); }
};

const clearHistoryFromDb = async () => {
    try {
        if (!db) await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) { console.warn('Error limpiando historial:', e); }
};

// Descripciones de los efectos para los tooltips
const EFFECT_DESCRIPTIONS = {
    brightness: "Ajusta el brillo general de la imagen.",
    contrast: "Controla la diferencia entre areas claras y oscuras.",
    saturation: "Intensifica o reduce la intensidad de los colores.",
    hue: "Desplaza los colores a lo largo del espectro cromatico.",
    blur: "Aplica un desenfoque suave a toda la imagen.",
    exposure: "Simula el ajuste para controlar la luminosidad.",
    temperature: "Ajusta la temperatura de color hacia tonos calidos o frios.",
    vignette: "Anade un efecto de vineta oscureciendo los bordes.",
    scale: "Amplia o reduce el tamano de la imagen.",
    rotation: "Gira la imagen.",
    clarity: "Mejora la claridad y definicion.",
    vibrance: "Intensifica los colores menos saturados.",
    noiseReduction: "Reduce el ruido digital.",
    sharpening: "Aumenta la nitidez.",
    filmGrain: "Anade grano cinematografico.",
    midtoneContrast: "Ajusta el contraste en los tonos medios.",
    hdrEffect: "Recupera detalle en altas luces y sombras.",
    ortonEffect: "Crea una atmosfera eterea.",
    focalBlur: "Aplica desenfoque selectivo del fondo.",
};

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
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

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
                output[idx] = Math.min(255, Math.max(0, data[idx] * (1 - amount) + sum * amount));
            }
        }
    }
    for (let i = 0; i < data.length; i++) {
        data[i] = output[i];
    }
};

const applyCenterBlur = (ctx, canvas, blurAmount = 15) => {
    const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.filter = `blur(${blurAmount}px)`;
    tempCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(originalImageData, 0, 0);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.35;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.9)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.filter = `blur(${blurAmount}px)`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    ctx.restore();
};

const getEffectsDescription = (settings) => {
    const effects = [];
    if (settings.brightness !== 100) effects.push(`Brillo: ${settings.brightness > 100 ? '+' : ''}${settings.brightness - 100}%`);
    if (settings.contrast !== 100) effects.push(`Contraste: ${settings.contrast > 100 ? '+' : ''}${settings.contrast - 100}%`);
    if (settings.saturation !== 100) effects.push(`Saturacion: ${settings.saturation > 100 ? '+' : ''}${settings.saturation - 100}%`);
    if (settings.hue !== 0) effects.push(`Matiz: ${settings.hue}°`);
    if (settings.blur !== 0) effects.push(`Desenfoque: ${settings.blur}px`);
    if (settings.exposure !== 0) effects.push(`Exposicion: ${settings.exposure > 0 ? '+' : ''}${settings.exposure}`);
    if (settings.temperature !== 0) effects.push(`Temperatura: ${settings.temperature > 0 ? '+' : ''}${settings.temperature}`);
    if (settings.vignette !== 0) effects.push(`Vineta: ${settings.vignette}%`);
    if (settings.scale !== 100) effects.push(`Escala: ${settings.scale}%`);
    if (settings.rotation !== 0) effects.push(`Rotacion: ${settings.rotation}°`);
    if (settings.clarity !== 0) effects.push(`Claridad: ${settings.clarity > 0 ? '+' : ''}${settings.clarity}`);
    if (settings.vibrance !== 0) effects.push(`Vibrancia: ${settings.vibrance > 0 ? '+' : ''}${settings.vibrance}`);
    if (settings.noiseReduction !== 0) effects.push(`Reduccion ruido: ${settings.noiseReduction}%`);
    if (settings.sharpening !== 0) effects.push(`Nitidez: ${settings.sharpening}%`);
    if (settings.filmGrain !== 0) effects.push(`Grano: ${settings.filmGrain}%`);
    if (settings.midtoneContrast !== 0) effects.push(`Contraste medios: ${settings.midtoneContrast > 0 ? '+' : ''}${settings.midtoneContrast}`);
    if (settings.hdrEffect !== 0) effects.push(`HDR: ${settings.hdrEffect}%`);
    if (settings.ortonEffect !== 0) effects.push(`Orton: ${settings.ortonEffect}%`);
    if (settings.focalBlur !== 0) effects.push(`Enfoque selectivo: ${settings.focalBlur}px`);
    return effects.length > 0 ? effects.join(', ') : 'Sin efectos aplicados';
};

const App = () => {
    const [uploadedFile, setUploadedFile] = useState(null);
    const [originalUploadedFile, setOriginalUploadedFile] = useState(null);
    const [originalImage, setOriginalImage] = useState(null);
    const [currentSettings, setCurrentSettings] = useState(INITIAL_SETTINGS);
    const [history, setHistory] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const [hoveredSlider, setHoveredSlider] = useState(null);
    const [hoveredHistoryItem, setHoveredHistoryItem] = useState(null);
    const [hoveredButton, setHoveredButton] = useState(null);
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [resizeModalOpen, setResizeModalOpen] = useState(false);
    const [rotateModalOpen, setRotateModalOpen] = useState(false);
    const [borderModalOpen, setBorderModalOpen] = useState(false);
    const [perspectiveModalOpen, setPerspectiveModalOpen] = useState(false);
    const [curvesModalOpen, setCurvesModalOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [isTextEditing, setIsTextEditing] = useState(false);
    const [textOverlays, setTextOverlays] = useState([]);
    const [selectedTextIdx, setSelectedTextIdx] = useState(-1);
    const [lastAppliedTexts, setLastAppliedTexts] = useState(null);
    const [preTextImage, setPreTextImage] = useState(null);
    const [manualActions, setManualActions] = useState([]);
    const [isColorPickerActive, setIsColorPickerActive] = useState(false);
    const [colorPickerPos, setColorPickerPos] = useState({ x: 0, y: 0 });
    const [colorPickerColor, setColorPickerColor] = useState('#000000');

    const canvasRef = useRef(null);
    const canvasContainerRef = useRef(null);
    const textOverlaysRef = useRef([]);
    const isReEditingRef = useRef(false);
    const preReEditImageRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => { textOverlaysRef.current = textOverlays; }, [textOverlays]);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const items = await loadHistoryFromDb();
                if (items.length > 0) setHistory(items);
            } catch (e) { console.warn('Error cargando historial:', e); }
        };
        loadHistory();
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
                setMessage("");
                setManualActions([]);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

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
            ctx.filter = `brightness(${brightnessVal}%) contrast(${currentSettings.contrast}%) saturate(${currentSettings.saturation}%) hue-rotate(${currentSettings.hue}deg) blur(${currentSettings.blur}px)`;
            ctx.drawImage(img, 0, 0);
            ctx.restore();

            if (currentSettings.temperature !== 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'overlay';
                ctx.fillStyle = currentSettings.temperature > 0 ? `rgba(255,140,0,${Math.abs(currentSettings.temperature) / 250})` : `rgba(0,100,255,${Math.abs(currentSettings.temperature) / 250})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.restore();
            }

            if (currentSettings.vignette > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'multiply';
                const maxDim = Math.max(canvas.width, canvas.height);
                const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width * 0.3, canvas.width / 2, canvas.height / 2, maxDim * 0.8);
                gradient.addColorStop(0, "rgba(0,0,0,0)");
                gradient.addColorStop(1, `rgba(0,0,0,${currentSettings.vignette / 100})`);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.restore();
            }

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
                    const r = data[i], g = data[i + 1], b = data[i + 2];
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
                    for (let c = 0; c < 3; c++) {
                        let value = data[i + c] / 255;
                        value = Math.pow(value, 1 / (1 + strength * 2));
                        value = value / (value + Math.pow(0.5, 1 / (1 + strength)));
                        data[i + c] = Math.min(255, Math.max(0, value * 255));
                    }
                }
                ctx.putImageData(imageData, 0, 0);
            }

            if (currentSettings.ortonEffect > 0) {
                ctx.save();
                const blurredCanvas = document.createElement('canvas');
                blurredCanvas.width = canvas.width;
                blurredCanvas.height = canvas.height;
                const blurredCtx = blurredCanvas.getContext('2d');
                blurredCtx.filter = `blur(${20 + currentSettings.ortonEffect / 5}px)`;
                blurredCtx.drawImage(canvas, 0, 0);
                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = currentSettings.ortonEffect / 200;
                ctx.drawImage(blurredCanvas, 0, 0);
                ctx.restore();
            }

            if (currentSettings.focalBlur > 0) {
                ctx.save();
                const gradient = ctx.createRadialGradient(
                    canvas.width * currentSettings.focalPoint.x / 100, canvas.height * currentSettings.focalPoint.y / 100, 0,
                    canvas.width * currentSettings.focalPoint.x / 100, canvas.height * currentSettings.focalPoint.y / 100, Math.max(canvas.width, canvas.height) * 0.7
                );
                gradient.addColorStop(0, "rgba(0,0,0,0)");
                gradient.addColorStop(0.3, "rgba(0,0,0,0)");
                gradient.addColorStop(1, "rgba(0,0,0,1)");
                const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                ctx.filter = `blur(${currentSettings.focalBlur}px)`;
                ctx.drawImage(canvas, 0, 0);
                const originalCanvas = document.createElement('canvas');
                originalCanvas.width = canvas.width;
                originalCanvas.height = canvas.height;
                const originalCtx = originalCanvas.getContext('2d');
                originalCtx.putImageData(originalImageData, 0, 0);
                ctx.globalCompositeOperation = 'destination-in';
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = 'destination-over';
                ctx.drawImage(originalCanvas, 0, 0);
                ctx.restore();
            }
            ctx.filter = 'none';
        };
    }, [originalImage, currentSettings]);

    useEffect(() => { renderImage(); }, [renderImage]);

    const handleMouseDown = (e) => {
        if (isColorPickerActive) {
            handleColorPick(e);
            return;
        }
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
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
        navigator.clipboard.writeText(color);
        setIsColorPickerActive(false);
        setMessage(`Color copiado: ${color}`);
        setTimeout(() => setMessage(""), 2000);
    };

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
            id: Date.now(), thumbnail: thumbUrl, originalSource: savedImage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            settings: { ...currentSettings }, effectsDescription: effectsDescription, manualActions: [...manualActions]
        };
        await saveHistoryItemToDb(newHistoryItem);
        setHistory(prev => [newHistoryItem, ...prev]);
        if (originalUploadedFile) setOriginalImage(originalUploadedFile);
        setUploadedFile(originalUploadedFile);
        setCurrentSettings(INITIAL_SETTINGS);
        setMessage("Guardado! Lienzo restaurado.");
        setManualActions([]);
        setTimeout(() => setMessage(""), 2000);
    };

    const restoreFromHistory = (item) => {
        if (!originalImage) return;
        setOriginalImage(item.originalSource);
        setCurrentSettings(item.settings || INITIAL_SETTINGS);
        setManualActions(item.manualActions || []);
    };

    const handleDownloadHistory = (item) => {
        const link = document.createElement('a');
        link.download = `editado-${item.id}.jpg`;
        link.href = item.originalSource;
        link.click();
    };

    const handleDeleteHistory = async (id) => {
        await deleteHistoryItemFromDb(id);
        setHistory(prev => prev.filter(item => item.id !== id));
    };

    const handleDeleteCurrentImage = () => {
        setOriginalImage(null); setUploadedFile(null); setOriginalUploadedFile(null);
        setCurrentSettings(INITIAL_SETTINGS); setMessage(""); setManualActions([]);
    };

    const handleOpenCropModal = () => {
        if (!originalImage) { setMessage("Primero debes subir una imagen"); setTimeout(() => setMessage(""), 3000); return; }
        setCropModalOpen(true);
    };

    const handleCropComplete = (croppedImage) => {
        setOriginalImage(croppedImage); setUploadedFile(croppedImage);
        setManualActions(prev => [...prev, "Recorte"]); setCurrentSettings(INITIAL_SETTINGS);
        setMessage("Imagen recortada"); setTimeout(() => setMessage(""), 3000);
    };

    const handleCenterBlur = () => {
        if (!originalImage) return;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            applyCenterBlur(ctx, canvas, 20);
            const blurredImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(blurredImage); setUploadedFile(blurredImage);
            setManualActions(prev => [...prev, "Difuminar Centro"]); setCurrentSettings(INITIAL_SETTINGS);
            setMessage("Centro difuminado"); setTimeout(() => setMessage(""), 3000);
        };
        img.src = originalImage;
    };

    const applyFilter = (filterType) => {
        if (!originalImage) return;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            switch (filterType) {
                case 'bw':
                    for (let i = 0; i < data.length; i += 4) {
                        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                        data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
                    }
                    ctx.putImageData(imageData, 0, 0);
                    break;
                case 'sepia':
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i], g = data[i + 1], b = data[i + 2];
                        data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                        data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                        data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                    }
                    ctx.putImageData(imageData, 0, 0);
                    break;
                case 'vintage':
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i], g = data[i + 1], b = data[i + 2];
                        data[i] = Math.min(255, (r * 0.9) + (g * 0.4) + (b * 0.1));
                        data[i + 1] = Math.min(255, (r * 0.3) + (g * 0.8) + (b * 0.1));
                        data[i + 2] = Math.min(255, (r * 0.2) + (g * 0.4) + (b * 0.6));
                        for (let j = 0; j < 3; j++) data[i + j] = data[i + j] * 0.85 + 25;
                    }
                    ctx.putImageData(imageData, 0, 0);
                    ctx.globalCompositeOperation = 'multiply';
                    const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width * 0.4, canvas.width / 2, canvas.height / 2, canvas.width * 0.8);
                    gradient.addColorStop(0, 'rgba(255,255,255,0)');
                    gradient.addColorStop(1, 'rgba(80,60,40,0.5)');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.globalCompositeOperation = 'source-over';
                    break;
                case 'noir':
                    for (let i = 0; i < data.length; i += 4) {
                        let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                        gray = (gray - 128) * 1.5 + 128;
                        gray = Math.max(0, Math.min(255, gray));
                        data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
                    }
                    ctx.putImageData(imageData, 0, 0);
                    break;
                case 'polaroid':
                    ctx.globalCompositeOperation = 'destination-over';
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    const padding = Math.min(canvas.width, canvas.height) * 0.08;
                    ctx.drawImage(img, padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);
                    break;
            }
            const filteredImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(filteredImage); setUploadedFile(filteredImage);
            const filterNames = { 'bw': 'Blanco y Negro', 'sepia': 'Sepia', 'vintage': 'Vintage', 'noir': 'Noir', 'polaroid': 'Polaroid' };
            setManualActions(prev => [...prev, `Filtro: ${filterNames[filterType]}`]);
            setCurrentSettings(INITIAL_SETTINGS);
            setMessage(`Filtro ${filterNames[filterType]} aplicado`);
            setTimeout(() => setMessage(""), 3000);
        };
        img.src = originalImage;
    };

    const handleFlipHorizontal = () => {
        if (!originalImage) return;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0);
            const flippedImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(flippedImage); setUploadedFile(flippedImage);
            setManualActions(prev => [...prev, "Espejo H"]); setCurrentSettings(INITIAL_SETTINGS);
            setMessage("Volteado H"); setTimeout(() => setMessage(""), 3000);
        };
        img.src = originalImage;
    };

    const handleFlipVertical = () => {
        if (!originalImage) return;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.translate(0, canvas.height);
            ctx.scale(1, -1);
            ctx.drawImage(img, 0, 0);
            const flippedImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(flippedImage); setUploadedFile(flippedImage);
            setManualActions(prev => [...prev, "Espejo V"]); setCurrentSettings(INITIAL_SETTINGS);
            setMessage("Volteado V"); setTimeout(() => setMessage(""), 3000);
        };
        img.src = originalImage;
    };

    const handleRotate90 = () => {
        if (!originalImage) return;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.height; canvas.height = img.width;
            const ctx = canvas.getContext('2d');
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(90 * Math.PI / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            const rotatedImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(rotatedImage); setUploadedFile(rotatedImage);
            setManualActions(prev => [...prev, "Rotar 90"]); setCurrentSettings(INITIAL_SETTINGS);
            setMessage("Rotado 90"); setTimeout(() => setMessage(""), 3000);
        };
        img.src = originalImage;
    };

    const handleResize = (newWidth, newHeight) => {
        if (!originalImage) return;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = newWidth; canvas.height = newHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            const resizedImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(resizedImage); setUploadedFile(resizedImage);
            setManualActions(prev => [...prev, `Redimensionar: ${newWidth}x${newHeight}`]);
            setCurrentSettings(INITIAL_SETTINGS);
            setMessage(`Redimensionado a ${newWidth}x${newHeight}`);
            setTimeout(() => setMessage(""), 3000);
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
            setOriginalImage(rotatedImage); setUploadedFile(rotatedImage);
            setManualActions(prev => [...prev, `Rotar ${angle}°`]); setCurrentSettings(INITIAL_SETTINGS);
            setMessage(`Rotado ${angle}°`); setTimeout(() => setMessage(""), 3000);
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
            ctx.fillStyle = borderColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, borderWidth, borderWidth);
            const borderedImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(borderedImage); setUploadedFile(borderedImage);
            setManualActions(prev => [...prev, `Marco: ${borderWidth}px`]);
            setCurrentSettings(INITIAL_SETTINGS);
            setMessage(`Marco anadido`); setTimeout(() => setMessage(""), 3000);
        };
        img.src = originalImage;
    };

    const handlePixelate = (pixelSize = 10) => {
        if (!originalImage) return;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = img.width / pixelSize;
            smallCanvas.height = img.height / pixelSize;
            const smallCtx = smallCanvas.getContext('2d');
            smallCtx.drawImage(img, 0, 0, smallCanvas.width, smallCanvas.height);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(smallCanvas, 0, 0, canvas.width, canvas.height);
            const pixelatedImage = canvas.toDataURL('image/jpeg', 0.95);
            setOriginalImage(pixelatedImage); setUploadedFile(pixelatedImage);
            setManualActions(prev => [...prev, "Pixelado"]);
            setCurrentSettings(INITIAL_SETTINGS);
            setMessage("Efecto pixelado aplicado");
            setTimeout(() => setMessage(""), 3000);
        };
        img.src = originalImage;
    };

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
            const resultImage = canvas.toDataURL();
            setOriginalImage(resultImage);
            setUploadedFile(resultImage);
            setMessage("Balance de blancos aplicado");
            setTimeout(() => setMessage(""), 2000);
        };
        img.src = originalImage;
    };

    const handlePerspective = (newImageSrc) => {
        setOriginalImage(newImageSrc);
        setUploadedFile(newImageSrc);
        setManualActions(prev => [...prev, "Perspectiva"]);
        setMessage("Perspectiva corregida");
        setTimeout(() => setMessage(""), 2000);
    };

    const handleCurves = (newImageSrc) => {
        setOriginalImage(newImageSrc);
        setUploadedFile(newImageSrc);
        setManualActions(prev => [...prev, "Curvas"]);
        setMessage("Curvas aplicadas");
        setTimeout(() => setMessage(""), 2000);
    };

    const handleExport = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = `editado-${Date.now()}.jpg`;
        link.href = canvasRef.current.toDataURL('image/jpeg', 0.95);
        link.click();
        setMessage("Imagen exportada");
        setTimeout(() => setMessage(""), 2000);
    };

    const addNewTextOverlay = () => {
        const text = prompt("Escribe el texto:");
        if (!text || !text.trim()) return false;
        const currentLen = textOverlaysRef.current.length;
        const newOverlay = { text: text.trim(), x: 20 + (currentLen * 5) % 30, y: 30 + (currentLen * 5) % 20, width: 50, height: 20, fontSize: 36, color: '#0ae674', fontFamily: 'Arial' };
        setTextOverlays(prev => [...prev, newOverlay]);
        setSelectedTextIdx(currentLen);
        return true;
    };

    const startTextEditing = () => {
        if (!originalImage) return;
        if (lastAppliedTexts && lastAppliedTexts.length > 0 && preTextImage) {
            const choice = confirm(`Tienes ${lastAppliedTexts.length} texto(s) aplicado(s).\\n\\n¿Quieres editarlos?\\n\\nAceptar = Editar\\nCancelar = Nuevo`);
            if (choice) {
                preReEditImageRef.current = originalImage;
                isReEditingRef.current = true;
                setOriginalImage(preTextImage);
                setUploadedFile(preTextImage);
                setTextOverlays(lastAppliedTexts.map(o => ({ ...o })));
                setSelectedTextIdx(0);
                setIsTextEditing(true);
                const canvas = canvasRef.current;
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0); };
                    img.src = preTextImage;
                }
                return;
            }
        }
        isReEditingRef.current = false;
        if (addNewTextOverlay()) {
            if (!preTextImage) setPreTextImage(originalImage);
            setIsTextEditing(true);
        }
    };

    const deleteTextOverlay = (idx) => {
        const currentLen = textOverlaysRef.current.length;
        setTextOverlays(prev => prev.filter((_, i) => i !== idx));
        if (selectedTextIdx === idx) setSelectedTextIdx(currentLen > 1 ? Math.max(0, idx - 1) : -1);
        else if (selectedTextIdx > idx) setSelectedTextIdx(prev => prev - 1);
        if (currentLen <= 1) setIsTextEditing(false);
    };

    const applyTextOverlay = () => {
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
            lines.forEach((line, i) => { ctx.fillText(line, centerX, startY + i * lineHeight); });
            textNames.push(ov.text.substring(0, 15));
        });
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        if (!preTextImage) setPreTextImage(originalImage);
        const imageWithText = canvas.toDataURL('image/jpeg', 0.95);
        setOriginalImage(imageWithText);
        setUploadedFile(imageWithText);
        if (isReEditingRef.current) setLastAppliedTexts(currentOverlays.map(o => ({ ...o })));
        else setLastAppliedTexts(prev => [...(prev || []), ...currentOverlays.map(o => ({ ...o }))]);
        isReEditingRef.current = false;
        preReEditImageRef.current = null;
        const desc = textNames.length === 1 ? `Texto: "${textNames[0]}${textNames[0].length >= 15 ? '...' : ''}"` : `${textNames.length} Textos`;
        setManualActions(prev => [...prev, desc]);
        setCurrentSettings(INITIAL_SETTINGS);
        setIsTextEditing(false);
        setTextOverlays([]);
        setSelectedTextIdx(-1);
        setMessage(textNames.length === 1 ? "Texto anadido" : `${textNames.length} textos anadidos`);
        setTimeout(() => setMessage(""), 3000);
    };

    const cancelTextOverlay = () => {
        if (isReEditingRef.current && preReEditImageRef.current) {
            const snapshotImage = preReEditImageRef.current;
            setOriginalImage(snapshotImage);
            setUploadedFile(snapshotImage);
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                const img = new Image();
                img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0); };
                img.src = snapshotImage;
            }
        }
        isReEditingRef.current = false;
        preReEditImageRef.current = null;
        setIsTextEditing(false);
        setTextOverlays([]);
        setSelectedTextIdx(-1);
    };

    const updateSetting = (key, value) => setCurrentSettings(prev => ({ ...prev, [key]: parseFloat(value) }));

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-300 font-sans">
            {cropModalOpen && <CropModal imageSrc={originalImage} onClose={() => setCropModalOpen(false)} onCrop={handleCropComplete} />}
            {resizeModalOpen && <ResizeModal imageSrc={originalImage} onClose={() => setResizeModalOpen(false)} onResize={handleResize} />}
            {rotateModalOpen && <RotateModal onClose={() => setRotateModalOpen(false)} onRotate={handleRotateFree} />}
            {borderModalOpen && <BorderModal onClose={() => setBorderModalOpen(false)} onAddBorder={handleAddBorder} />}
            {perspectiveModalOpen && <PerspectiveModal imageSrc={originalImage} onClose={() => setPerspectiveModalOpen(false)} onApply={handlePerspective} />}
            {curvesModalOpen && <CurvesModal imageSrc={originalImage} onClose={() => setCurvesModalOpen(false)} onApply={handleCurves} />}
            {exportModalOpen && <ExportModal onClose={() => setExportModalOpen(false)} onExport={handleExport} />}
            <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-2 text-blue-400 select-none">
                    <i data-lucide="aperture" className="w-6 h-6"></i>
                    <h1 className="font-bold text-lg text-white tracking-tight"><span className="font-light text-blue-200">Editor Local</span></h1>
                </div>
                <div className="flex gap-3 items-center">
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                    <button onClick={() => fileInputRef.current.click()} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm font-medium transition flex items-center gap-2 border border-slate-600">
                        <i data-lucide="upload" className="w-4 h-4"></i><span className="hidden sm:inline">Subir</span>
                    </button>
                    {originalImage && (
                        <button onClick={() => setExportModalOpen(true)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition flex items-center gap-2 border border-blue-500">
                            <i data-lucide="download" className="w-4 h-4"></i><span className="hidden sm:inline">Exportar</span>
                        </button>
                    )}
                </div>
            </header>
            <main className="flex-1 flex overflow-hidden">
                <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-10">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                        <div className="p-4 bg-gradient-to-br from-indigo-900/50 to-slate-900 rounded-xl border border-indigo-500/40 shadow-lg relative overflow-hidden">
                            <div className="space-y-2">
                                <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <i data-lucide="wrench" className="w-3 h-3"></i> Herramientas
                                </h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: "Recortar", label: "Recortar", icon: "crop", func: handleOpenCropModal, desc: "Recorta la imagen." },
                                        { id: "Difuminar Centro", label: "Difuminar Centro", icon: "circle-dot", func: handleCenterBlur, desc: "Difumina el centro." },
                                        { id: "B&N", label: "B&N", icon: "contrast", func: () => applyFilter('bw'), desc: "Blanco y negro." },
                                        { id: "Sepia", label: "Sepia", icon: "coffee", func: () => applyFilter('sepia'), desc: "Efecto sepia." },
                                        { id: "Vintage", label: "Vintage", icon: "camera", func: () => applyFilter('vintage'), desc: "Efecto vintage." },
                                        { id: "Noir", label: "Noir", icon: "moon", func: () => applyFilter('noir'), desc: "Alto contraste B&N." },
                                        { id: "Espejo H", label: "Espejo H", icon: "flip-horizontal", func: handleFlipHorizontal, desc: "Voltea horizontal." },
                                        { id: "Espejo V", label: "Espejo V", icon: "flip-vertical", func: handleFlipVertical, desc: "Voltea vertical." },
                                        { id: "Rotar 90", label: "Rotar 90", icon: "rotate-cw", func: handleRotate90, desc: "Rota 90 grados." },
                                        { id: "Redimensionar", label: "Redimensionar", icon: "maximize", func: () => setResizeModalOpen(true), desc: "Cambia tamano." },
                                        { id: "Rotar Libre", label: "Rotar Libre", icon: "rotate-ccw", func: () => setRotateModalOpen(true), desc: "Rota libremente." },
                                        { id: "Marco", label: "Marco", icon: "square", func: () => setBorderModalOpen(true), desc: "Anade marco." },
                                        { id: "Texto", label: "Texto", icon: "type", func: startTextEditing, desc: "Anade texto." },
                                        { id: "Pixelar", label: "Pixelar", icon: "grid-3x3", func: () => handlePixelate(10), desc: "Efecto pixelado." },
                                        { id: "Color Picker", label: "Color Picker", icon: "pipette", func: () => setIsColorPickerActive(!isColorPickerActive), desc: "Selecciona color.", active: isColorPickerActive },
                                        { id: "Perspectiva", label: "Perspectiva", icon: "scan", func: () => setPerspectiveModalOpen(true), desc: "Corrige perspectiva." },
                                        { id: "Curvas", label: "Curvas", icon: "activity", func: () => setCurvesModalOpen(true), desc: "Ajusta curvas." },
                                        { id: "Balance Auto", label: "Balance Auto", icon: "sun", func: handleAutoWhiteBalance, desc: "Balance automatico." }
                                    ].map((btn) => (
                                        <button key={btn.id} onClick={() => btn.func()} disabled={!originalImage} onMouseEnter={() => setHoveredButton({ label: btn.label, description: btn.desc })} onMouseLeave={() => setHoveredButton(null)} className={`py-1.5 text-[10px] rounded border transition-all duration-200 flex justify-center items-center gap-1 ${hoveredButton?.label === btn.label || btn.active ? "bg-blue-600 border-blue-300 text-white scale-[1.05] z-10 shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "bg-slate-700 border-slate-600 text-slate-200"} ${btn.active ? "ring-2 ring-blue-400" : ""}`}>
                                            <i data-lucide={btn.icon} className="w-3 h-3"></i> {btn.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {hoveredButton && (
                                <div className="absolute inset-0 p-3 flex flex-col justify-center bg-slate-900/90 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200 z-20">
                                    <div className="text-blue-300 font-bold text-sm tracking-wide border-b border-white/10 pb-1 mb-1">{hoveredButton.label}</div>
                                    <div className="text-slate-200 font-light text-[12px] leading-tight">{hoveredButton.description}</div>
                                </div>
                            )}
                            {message && <div className="mt-3 relative group"><div className="text-[10px] font-mono p-3 bg-black/40 border border-indigo-500/20 rounded-lg text-indigo-200 break-words max-h-64 overflow-y-auto custom-scrollbar whitespace-pre-wrap">{message}</div></div>}
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500 tracking-wider mb-2"><i data-lucide="sun" className="w-3 h-3"></i> Luz</div>
                                <SliderControl label="Brillo" value={currentSettings.brightness} min={0} max={200} onChange={(v) => updateSetting('brightness', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.brightness} />
                                <SliderControl label="Contraste" value={currentSettings.contrast} min={0} max={200} onChange={(v) => updateSetting('contrast', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.contrast} />
                                <SliderControl label="Exposicion" value={currentSettings.exposure} min={-5} max={5} step={0.1} onChange={(v) => updateSetting('exposure', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.exposure} />
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500 tracking-wider mb-2"><i data-lucide="palette" className="w-3 h-3"></i> Color</div>
                                <SliderControl label="Saturacion" value={currentSettings.saturation} min={0} max={200} onChange={(v) => updateSetting('saturation', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.saturation} />
                                <SliderControl label="Temperatura" value={currentSettings.temperature} min={-100} max={100} onChange={(v) => updateSetting('temperature', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.temperature} />
                                <SliderControl label="Matiz" value={currentSettings.hue} min={0} max={360} onChange={(v) => updateSetting('hue', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.hue} />
                                <SliderControl label="Vibrancia" value={currentSettings.vibrance} min={-100} max={100} onChange={(v) => updateSetting('vibrance', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.vibrance} />
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500 tracking-wider mb-2"><i data-lucide="wand-2" className="w-3 h-3"></i> Efectos</div>
                                <SliderControl label="Desenfoque" value={currentSettings.blur} min={0} max={20} step={0.5} onChange={(v) => updateSetting('blur', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.blur} />
                                <SliderControl label="Vineta" value={currentSettings.vignette} min={0} max={100} onChange={(v) => updateSetting('vignette', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.vignette} />
                                <SliderControl label="Nitidez" value={currentSettings.sharpening} min={0} max={100} onChange={(v) => updateSetting('sharpening', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.sharpening} />
                                <SliderControl label="Claridad" value={currentSettings.clarity} min={-100} max={100} onChange={(v) => updateSetting('clarity', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.clarity} />
                                <SliderControl label="Reduccion Ruido" value={currentSettings.noiseReduction} min={0} max={100} onChange={(v) => updateSetting('noiseReduction', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.noiseReduction} />
                                <SliderControl label="Grano" value={currentSettings.filmGrain} min={0} max={100} onChange={(v) => updateSetting('filmGrain', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.filmGrain} />
                                <SliderControl label="Orton" value={currentSettings.ortonEffect} min={0} max={100} onChange={(v) => updateSetting('ortonEffect', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.ortonEffect} />
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500 tracking-wider mb-2"><i data-lucide="move" className="w-3 h-3"></i> Transformacion</div>
                                <SliderControl label="Zoom (%)" value={currentSettings.scale} min={10} max={300} onChange={(v) => updateSetting('scale', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.scale} />
                                <SliderControl label="Rotacion" value={currentSettings.rotation} min={0} max={360} onChange={(v) => updateSetting('rotation', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.rotation} />
                                <div className="text-[10px] text-slate-500 italic mt-1 text-center bg-slate-800/50 rounded py-1">Arrastra la imagen para mover</div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500 tracking-wider mb-2"><i data-lucide="aperture" className="w-3 h-3"></i> Avanzado</div>
                                <SliderControl label="Enfoque Selectivo" value={currentSettings.focalBlur} min={0} max={50} onChange={(v) => updateSetting('focalBlur', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.focalBlur} />
                                <SliderControl label="Contraste Medios" value={currentSettings.midtoneContrast} min={-100} max={100} onChange={(v) => updateSetting('midtoneContrast', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.midtoneContrast} />
                                <SliderControl label="HDR" value={currentSettings.hdrEffect} min={0} max={100} onChange={(v) => updateSetting('hdrEffect', v)} onHover={(label) => setHoveredSlider(label)} description={EFFECT_DESCRIPTIONS.hdrEffect} />
                            </div>
                        </div>
                        {hoveredSlider && (
                            <div className="glass-popup pointer-events-none fixed z-50 p-4 w-64" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                                <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2"><span className="font-bold text-blue-300 text-lg tracking-wide">{hoveredSlider.label}</span></div>
                                <div className="leading-snug text-slate-200 font-light text-[14px] text-left tracking-wide">{hoveredSlider.description}</div>
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-3">
                        <button onClick={saveToHistory} disabled={!originalImage} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-slate-700 text-white font-bold rounded-lg shadow-lg transition flex justify-center items-center gap-2">
                            <i data-lucide="save" className="w-4 h-4"></i><span>GUARDAR EN HISTORIAL</span>
                        </button>
                    </div>
                </aside>
                <section ref={canvasContainerRef} className="flex-1 canvas-container flex items-center justify-center relative overflow-hidden bg-slate-950">
                    {!originalImage && (
                        <div className="text-center p-12 border-2 border-dashed border-slate-700/50 rounded-2xl bg-slate-800/30 backdrop-blur-sm max-w-md mx-auto relative z-10 pointer-events-none">
                            <h3 className="text-lg font-medium text-slate-200 mb-1">Editor Local</h3>
                            <p className="text-sm text-slate-500 mb-6">Sube imagenes y editalas.</p>
                            <button onClick={() => fileInputRef.current.click()} className="pointer-events-auto px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm font-medium transition">Subir imagen</button>
                        </div>
                    )}
                    <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} className={`max-w-full max-h-full object-contain shadow-2xl ring-1 ring-white/10 transition-opacity duration-300 ${!originalImage ? 'opacity-0 absolute' : 'opacity-100'} ${isColorPickerActive ? 'cursor-none' : (isDragging ? 'cursor-grabbing' : 'cursor-grab')}`}></canvas>
                    {isTextEditing && textOverlays.length > 0 && canvasContainerRef.current && (
                        <TextOverlayEditor overlays={textOverlays} setOverlays={setTextOverlays} selectedIdx={selectedTextIdx} setSelectedIdx={setSelectedTextIdx} containerRef={canvasContainerRef} onApply={applyTextOverlay} onCancel={cancelTextOverlay} onAdd={addNewTextOverlay} onDelete={deleteTextOverlay} />
                    )}
                    {isColorPickerActive && originalImage && (
                        <div style={{ position: 'absolute', left: colorPickerPos.x - 20, top: colorPickerPos.y - 20, width: 40, height: 40, borderRadius: '50%', border: '3px solid white', boxShadow: '0 0 0 2px black, 0 4px 12px rgba(0,0,0,0.5)', backgroundColor: colorPickerColor, pointerEvents: 'none', zIndex: 100 }}></div>
                    )}
                    {originalImage && (
                        <button onClick={handleDeleteCurrentImage} className="absolute top-4 right-4 px-3 py-1.5 bg-red-600/95 hover:bg-red-500 text-white text-xs font-medium rounded-full shadow-lg flex items-center gap-1 border border-red-400 z-20">
                            <i data-lucide="trash-2" className="w-4 h-4"></i><span>Eliminar</span>
                        </button>
                    )}
                </section>
                <aside className="w-64 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-10">
                    <div className="p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
                        <h2 className="font-bold text-sm text-slate-300 flex items-center gap-2"><i data-lucide="history" className="w-4 h-4 text-slate-400"></i>Historial</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                        {history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-600"><i data-lucide="images" className="w-8 h-8 mb-2 opacity-20"></i><p className="text-xs">Sin ediciones</p></div>
                        ) : (
                            history.map((item, index) => (
                                <div key={item.id} onClick={() => restoreFromHistory(item)} onMouseEnter={() => setHoveredHistoryItem(item.id)} onMouseLeave={() => setHoveredHistoryItem(null)} className="group relative bg-slate-800 rounded-lg p-2 border border-slate-700/60 hover:border-blue-500 hover:bg-slate-750 transition-all duration-200 hover:shadow-md cursor-pointer">
                                    <span className="absolute top-2 left-2 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-sm z-20">#{history.length - index}</span>
                                    <div className="relative aspect-square bg-slate-950 rounded mb-2 overflow-hidden border border-slate-800">
                                        <img src={item.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Version" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-2 z-10">
                                            <div className="flex w-full gap-2 justify-center">
                                                <button onClick={(e) => { e.stopPropagation(); handleDownloadHistory(item); }} className="flex-1 flex flex-col items-center gap-1 text-[9px] text-slate-100" title="Descargar">
                                                    <div className="w-7 h-7 rounded-full bg-slate-900/90 border border-slate-500 flex items-center justify-center shadow"><i data-lucide="download" className="w-3 h-3"></i></div><span>Descargar</span>
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); restoreFromHistory(item); }} className="flex-1 flex flex-col items-center gap-1 text-[9px] text-sky-100" title="Editar">
                                                    <div className="w-7 h-7 rounded-full bg-sky-700/90 border border-sky-400 flex items-center justify-center shadow"><i data-lucide="pencil" className="w-3 h-3"></i></div><span>Editar</span>
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteHistory(item.id); }} className="flex-1 flex flex-col items-center gap-1 text-[9px] text-red-100" title="Eliminar">
                                                    <div className="w-7 h-7 rounded-full bg-red-700/90 border border-red-400 flex items-center justify-center shadow"><i data-lucide="trash-2" className="w-3 h-3"></i></div><span>Eliminar</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {hoveredHistoryItem === item.id && item.effectsDescription && (
                                        <div className="glass-popup absolute bottom-1/2 right-0 mb-0 p-4 w-56 z-50 whitespace-normal">
                                            <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2"><span className="font-bold text-blue-300 text-lg tracking-wide">Efectos</span></div>
                                            <div className="leading-snug text-slate-200 font-light text-[14px] text-left tracking-wide">{item.effectsDescription}</div>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] text-slate-500 font-mono">{item.timestamp}</span>
                                        <span className="text-[10px] text-blue-400">Guardada</span>
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
            <label className="text-xs text-slate-400 group-hover:text-blue-300 transition-colors font-medium cursor-pointer">{label}</label>
            <span className="text-[10px] text-slate-500 font-mono bg-slate-800 px-1.5 rounded group-hover:text-white transition-colors">{Math.round(value * 10) / 10}</span>
        </div>
        <div className="relative h-4 flex items-center">
            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value)} onMouseEnter={() => onHover({ label, description })} onMouseLeave={() => onHover(null)} onMouseDown={() => onHover(null)} onTouchStart={() => onHover(null)} className="w-full z-10 relative cursor-pointer" />
            <div className="absolute left-0 right-0 h-1 bg-slate-700 rounded-full overflow-hidden top-1/2 -translate-y-1/2 pointer-events-none">
                <div className="h-full bg-blue-600/50" style={{ width: `${((value - min) / (max - min)) * 100}%` }}></div>
            </div>
        </div>
    </div>
);

const CropModal = ({ imageSrc, onClose, onCrop }) => {
    const canvasRef = useRef(null);
    const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageLoaded, setImageLoaded] = useState(false);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const imageRef = useRef(null);
    const scaleRef = useRef(1);

    useEffect(() => {
        if (!imageSrc) return;
        const img = new Image();
        img.onload = () => {
            imageRef.current = img;
            setImageLoaded(true);
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
            const initialCropWidth = canvasWidth * 0.8;
            const initialCropHeight = canvasHeight * 0.8;
            setCropArea({ x: (canvasWidth - initialCropWidth) / 2, y: (canvasHeight - initialCropHeight) / 2, width: initialCropWidth, height: initialCropHeight });
        };
        img.src = imageSrc;
    }, [imageSrc]);

    useEffect(() => { if (imageLoaded && canvasRef.current) drawCanvas(); }, [imageLoaded, cropArea, canvasSize]);

    const drawCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = imageRef.current;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
        ctx.drawImage(img, cropArea.x / scaleRef.current, cropArea.y / scaleRef.current, cropArea.width / scaleRef.current, cropArea.height / scaleRef.current, cropArea.x, cropArea.y, cropArea.width, cropArea.height);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    };

    const getMousePos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        return { x: (e.clientX || e.touches[0].clientX) - rect.left, y: (e.clientY || e.touches[0].clientY) - rect.top };
    };

    const handleMouseDown = (e) => {
        e.preventDefault();
        const pos = getMousePos(e);
        if (pos.x >= cropArea.x && pos.x <= cropArea.x + cropArea.width && pos.y >= cropArea.y && pos.y <= cropArea.y + cropArea.height) {
            setIsDragging(true);
            setDragStart({ x: pos.x - cropArea.x, y: pos.y - cropArea.y });
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const pos = getMousePos(e);
        let newX = pos.x - dragStart.x;
        let newY = pos.y - dragStart.y;
        newX = Math.max(0, Math.min(newX, canvasSize.width - cropArea.width));
        newY = Math.max(0, Math.min(newY, canvasSize.height - cropArea.height));
        setCropArea(prev => ({ ...prev, x: newX, y: newY }));
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleCrop = () => {
        if (!imageRef.current) return;
        const img = imageRef.current;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const sourceX = cropArea.x / scaleRef.current;
        const sourceY = cropArea.y / scaleRef.current;
        const sourceWidth = cropArea.width / scaleRef.current;
        const sourceHeight = cropArea.height / scaleRef.current;
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;
        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
        onCrop(canvas.toDataURL('image/jpeg', 0.95));
        onClose();
    };

    if (!imageLoaded) {
        return (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="glass-modal w-full max-w-4xl p-8 rounded-2xl relative">
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-blue-500 animate-spin mb-4"></div>
                        <p className="text-white">Cargando...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-modal w-full max-w-5xl max-h-[90vh] rounded-2xl relative flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center"><i data-lucide="crop" className="w-5 h-5 text-white"></i></div>
                        <div><h2 className="text-xl font-bold text-white">Recortar</h2><p className="text-xs text-slate-400">Arrastra el area seleccionada</p></div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-lg transition"><i data-lucide="x" className="w-5 h-5 text-slate-400"></i></button>
                </div>
                <div className="flex-1 overflow-auto p-6 flex flex-col items-center gap-6">
                    <div className="relative bg-slate-950 rounded-lg overflow-hidden shadow-2xl" style={{ maxWidth: '100%' }}>
                        <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp} className={`${isDragging ? 'cursor-grabbing' : 'cursor-grab'} max-w-full h-auto`} />
                    </div>
                    <div className="text-center text-sm text-slate-400">
                        <span className="text-slate-300 font-medium">{Math.round(cropArea.width / scaleRef.current)} x {Math.round(cropArea.height / scaleRef.current)} px</span>
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-700/50 flex items-center justify-between">
                    <button onClick={onClose} className="px-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-600 transition">Cancelar</button>
                    <button onClick={handleCrop} className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium border border-emerald-500 transition flex items-center gap-2"><i data-lucide="check" className="w-4 h-4"></i>Aplicar</button>
                </div>
            </div>
        </div>
    );
};

const ResizeModal = ({ imageSrc, onClose, onResize }) => {
    const [width, setWidth] = useState(800);
    const [height, setHeight] = useState(600);
    const [maintainAspect, setMaintainAspect] = useState(true);
    const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (imageSrc) {
            const img = new Image();
            img.onload = () => { setOriginalSize({ width: img.width, height: img.height }); setWidth(img.width); setHeight(img.height); };
            img.src = imageSrc;
        }
    }, [imageSrc]);

    const handleWidthChange = (e) => {
        const newWidth = parseInt(e.target.value) || 0;
        setWidth(newWidth);
        if (maintainAspect && originalSize.width > 0) setHeight(Math.round(newWidth * (originalSize.height / originalSize.width)));
    };

    const handleHeightChange = (e) => {
        const newHeight = parseInt(e.target.value) || 0;
        setHeight(newHeight);
        if (maintainAspect && originalSize.height > 0) setWidth(Math.round(newHeight * (originalSize.width / originalSize.height)));
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-modal w-full max-w-md rounded-2xl relative overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700/50"><h2 className="text-xl font-bold text-white">Redimensionar</h2><p className="text-xs text-slate-400 mt-1">Original: {originalSize.width} x {originalSize.height} px</p></div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs text-slate-400 block mb-2">Ancho (px)</label><input type="number" value={width} onChange={handleWidthChange} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm" min="1" /></div>
                        <div><label className="text-xs text-slate-400 block mb-2">Alto (px)</label><input type="number" value={height} onChange={handleHeightChange} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm" min="1" /></div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={maintainAspect} onChange={(e) => setMaintainAspect(e.target.checked)} className="w-4 h-4 rounded border-slate-600" /><span className="text-sm text-slate-300">Mantener proporcion</span></label>
                </div>
                <div className="px-6 py-4 border-t border-slate-700/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm">Cancelar</button>
                    <button onClick={() => { onResize(width, height); onClose(); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">Aplicar</button>
                </div>
            </div>
        </div>
    );
};

const RotateModal = ({ onClose, onRotate }) => {
    const [angle, setAngle] = useState(0);
    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-modal w-full max-w-sm rounded-2xl relative overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700/50"><h2 className="text-xl font-bold text-white">Rotar</h2></div>
                <div className="p-6 space-y-4">
                    <div><label className="text-xs text-slate-400 block mb-2">Angulo: {angle} degrees</label><input type="range" min="-180" max="180" value={angle} onChange={(e) => setAngle(parseInt(e.target.value))} className="w-full" /><div className="flex justify-between text-xs text-slate-500 mt-1"><span>-180 degrees</span><span>0 degrees</span><span>+180 degrees</span></div></div>
                    <input type="number" value={angle} onChange={(e) => setAngle(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm text-center" />
                </div>
                <div className="px-6 py-4 border-t border-slate-700/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm">Cancelar</button>
                    <button onClick={() => { onRotate(angle); onClose(); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">Aplicar</button>
                </div>
            </div>
        </div>
    );
};

const BorderModal = ({ onClose, onAddBorder }) => {
    const [borderWidth, setBorderWidth] = useState(20);
    const [borderColor, setBorderColor] = useState('#ffffff');
    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-modal w-full max-w-sm rounded-2xl relative overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700/50"><h2 className="text-xl font-bold text-white">Anadir Marco</h2></div>
                <div className="p-6 space-y-4">
                    <div><label className="text-xs text-slate-400 block mb-2">Ancho: {borderWidth}px</label><input type="range" min="5" max="100" value={borderWidth} onChange={(e) => setBorderWidth(parseInt(e.target.value))} className="w-full" /></div>
                    <div><label className="text-xs text-slate-400 block mb-2">Color</label><div className="flex gap-2 flex-wrap">
                        {['#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'].map(color => (
                            <button key={color} onClick={() => setBorderColor(color)} className={`w-8 h-8 rounded-lg border-2 ${borderColor === color ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: color }} />
                        ))}
                    </div><input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="w-full mt-2 h-10 rounded cursor-pointer" /></div>
                </div>
                <div className="px-6 py-4 border-t border-slate-700/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm">Cancelar</button>
                    <button onClick={() => { onAddBorder(borderWidth, borderColor); onClose(); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">Aplicar</button>
                </div>
            </div>
        </div>
    );
};

const TextOverlayEditor = ({ overlays, setOverlays, selectedIdx, setSelectedIdx, containerRef, onApply, onCancel, onAdd, onDelete }) => {
    const [dragState, setDragState] = useState(null);
    const FONTS = ['Arial', 'Georgia', 'Courier New', 'Impact', 'Verdana', 'Times New Roman', 'Comic Sans MS'];
    const HANDLE_SIZE = 10;
    const selected = selectedIdx >= 0 && selectedIdx < overlays.length ? overlays[selectedIdx] : null;

    const updateOverlay = (idx, updates) => setOverlays(prev => prev.map((o, i) => i === idx ? { ...o, ...updates } : o));

    const handleMouseDown = (e, type, handle = null) => {
        e.preventDefault(); e.stopPropagation();
        if (selectedIdx < 0) return;
        setDragState({ type, handle, startX: e.clientX, startY: e.clientY, startOverlay: { ...overlays[selectedIdx] } });
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
            if (dragState.type === 'move') updateOverlay(selectedIdx, { x: Math.max(0, Math.min(100 - s.width, s.x + dx)), y: Math.max(0, Math.min(100 - s.height, s.y + dy)) });
            else if (dragState.type === 'resize') {
                const h = dragState.handle;
                let newX = s.x, newY = s.y, newW = s.width, newH = s.height;
                const MIN = 5;
                if (h.includes('l')) { newX = s.x + dx; newW = s.width - dx; }
                if (h.includes('r')) { newW = s.width + dx; }
                if (h.includes('t')) { newY = s.y + dy; newH = s.height - dy; }
                if (h.includes('b')) { newH = s.height + dy; }
                if (newW >= MIN && newH >= MIN) updateOverlay(selectedIdx, { x: Math.max(0, newX), y: Math.max(0, newY), width: Math.min(100, newW), height: Math.min(100, newH) });
            }
        };
        const handleMouseUp = () => setDragState(null);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
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
            {overlays.map((ov, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                    <div key={idx} style={{ position: 'absolute', left: `${ov.x}%`, top: `${ov.y}%`, width: `${ov.width}%`, height: `${ov.height}%`, zIndex: isSelected ? 50 : 40, cursor: isSelected ? (dragState?.type === 'move' ? 'grabbing' : 'grab') : 'pointer', userSelect: 'none' }} onMouseDown={(e) => { if (isSelected) handleMouseDown(e, 'move'); else { e.preventDefault(); e.stopPropagation(); setSelectedIdx(idx); } }}>
                        <div style={{ position: 'absolute', inset: 0, border: isSelected ? '2px dashed rgba(59, 130, 246, 0.9)' : '1px dashed rgba(148, 163, 184, 0.5)', borderRadius: 4, background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, overflow: 'hidden', fontFamily: ov.fontFamily, fontSize: `${ov.fontSize}px`, fontWeight: 'bold', color: ov.color, textShadow: '2px 2px 4px rgba(0,0,0,0.6)', textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.2, pointerEvents: 'none' }}>{ov.text}</div>
                        <div style={{ position: 'absolute', top: -8, left: -8, width: 18, height: 18, borderRadius: '50%', background: isSelected ? '#3b82f6' : '#64748b', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.4)', pointerEvents: 'none' }}>{idx + 1}</div>
                        {isSelected && handles.map(h => (<div key={h.id} style={{ position: 'absolute', width: HANDLE_SIZE, height: HANDLE_SIZE, background: '#3b82f6', border: '2px solid #fff', borderRadius: '50%', cursor: h.cursor, zIndex: 51, boxShadow: '0 1px 3px rgba(0,0,0,0.4)', ...h.style }} onMouseDown={(e) => handleMouseDown(e, 'resize', handleDir[h.id])} />))}
                    </div>
                );
            })}
            <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 55, display: 'flex', gap: 6, alignItems: 'center', padding: '6px 10px', background: 'rgba(15, 23, 42, 0.95)', borderRadius: 12, border: '1px solid rgba(100, 116, 139, 0.4)', backdropFilter: 'blur(8px)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '90%' }}>
                {selected ? (
                    <>
                        <select value={selected.fontFamily} onChange={(e) => updateOverlay(selectedIdx, { fontFamily: e.target.value })} style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 6, padding: '4px 6px', fontSize: 11, outline: 'none', cursor: 'pointer' }}>{FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}</select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ fontSize: 10, color: '#94a3b8' }}>Tam</span><input type="range" min="12" max="120" value={selected.fontSize} onChange={(e) => updateOverlay(selectedIdx, { fontSize: parseInt(e.target.value) })} style={{ width: 60, accentColor: '#3b82f6' }} /><span style={{ fontSize: 10, color: '#cbd5e1', minWidth: 20 }}>{selected.fontSize}</span></div>
                        <input type="color" value={selected.color} onChange={(e) => updateOverlay(selectedIdx, { color: e.target.value })} style={{ width: 26, height: 26, border: '1px solid #475569', borderRadius: 6, cursor: 'pointer', padding: 1, background: 'transparent' }} />
                        <input type="text" value={selected.text} onChange={(e) => updateOverlay(selectedIdx, { text: e.target.value })} placeholder="Texto..." style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 6, padding: '4px 8px', fontSize: 11, outline: 'none', width: 120, minWidth: 80 }} />
                        <button onClick={() => onDelete(selectedIdx)} title="Eliminar" style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', borderRadius: 6, padding: '4px 7px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                        <div style={{ width: 1, height: 20, background: '#475569' }} />
                    </>
                ) : (<span style={{ fontSize: 11, color: '#94a3b8' }}>Haz clic en un texto</span>)}
                <button onClick={onAdd} title="Anadir" style={{ background: '#1e40af', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ Texto</button>
                <button onClick={onApply} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✓ Aplicar</button>
                <button onClick={onCancel} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 7px', fontSize: 11, cursor: 'pointer' }}>✕</button>
            </div>
        </>
    );
};

const PerspectiveModal = ({ imageSrc, onClose, onApply }) => {
    const [vertical, setVertical] = useState(0);
    const [horizontal, setHorizontal] = useState(0);
    const [previewUrl, setPreviewUrl] = useState(null);

    useEffect(() => {
        if (imageSrc) updatePreview();
    }, [imageSrc, vertical, horizontal]);

    const updatePreview = () => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (vertical !== 0) {
                const strips = 50;
                const h = img.height / strips;
                for (let i = 0; i < strips; i++) {
                    const y = i * h;
                    let scale = 1;
                    const progress = i / strips;
                    if (vertical > 0) scale = 1 - (progress * (vertical / 100));
                    else scale = 1 - ((1 - progress) * (-vertical / 100));
                    const w = img.width * scale;
                    const x = (img.width - w) / 2;
                    ctx.drawImage(img, 0, y, img.width, h, x, y, w, h);
                }
            } else if (horizontal !== 0) {
                const strips = 50;
                const w = img.width / strips;
                for (let i = 0; i < strips; i++) {
                    const x = i * w;
                    let scale = 1;
                    const progress = i / strips;
                    if (horizontal > 0) scale = 1 - (progress * (horizontal / 100));
                    else scale = 1 - ((1 - progress) * (-horizontal / 100));
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
                <div className="px-6 py-4 border-b border-slate-700/50"><h2 className="text-xl font-bold text-white">Perspectiva</h2></div>
                <div className="p-6 space-y-6">
                    <div className="bg-slate-950 rounded border border-slate-800 h-64 flex items-center justify-center overflow-hidden">
                        {previewUrl && <img src={previewUrl} className="max-h-full object-contain" />}
                    </div>
                    <div>
                        <div className="flex justify-between mb-2"><label className="text-xs text-slate-400">Vertical</label><span className="text-xs text-blue-400">{vertical}</span></div>
                        <input type="range" min="-50" max="50" value={vertical} onChange={e => { setVertical(parseInt(e.target.value)); setHorizontal(0); }} className="w-full" />
                    </div>
                    <div>
                        <div className="flex justify-between mb-2"><label className="text-xs text-slate-400">Horizontal</label><span className="text-xs text-blue-400">{horizontal}</span></div>
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

const CurvesModal = ({ imageSrc, onClose, onApply }) => {
    const [points, setPoints] = useState([{ x: 0, y: 255 }, { x: 255, y: 0 }]);
    const graphCanvasRef = useRef(null);
    const [dragIdx, setDragIdx] = useState(-1);
    const [previewUrl, setPreviewUrl] = useState(null);
    const originalImageDataRef = useRef(null);

    useEffect(() => {
        if (!imageSrc) return;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            originalImageDataRef.current = { width: img.width, height: img.height, data: ctx.getImageData(0, 0, img.width, img.height) };
            setPreviewUrl(imageSrc);
        };
        img.src = imageSrc;
    }, [imageSrc]);

    const generateLUT = (pts) => {
        const lut = new Uint8Array(256);
        const sorted = [...pts].sort((a, b) => a.x - b.x);
        for (let i = 0; i < 256; i++) {
            if (i <= sorted[0].x) lut[i] = Math.max(0, Math.min(255, 255 - sorted[0].y));
            else if (i >= sorted[sorted.length - 1].x) lut[i] = Math.max(0, Math.min(255, 255 - sorted[sorted.length - 1].y));
            else {
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

    useEffect(() => {
        drawGraph();
        if (!originalImageDataRef.current) return;
        const lut = generateLUT(points);
        const { width, height, data: origData } = originalImageDataRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const newImageData = ctx.createImageData(width, height);
        const src = origData.data;
        const dst = newImageData.data;
        for (let i = 0; i < src.length; i += 4) {
            dst[i] = lut[src[i]];
            dst[i + 1] = lut[src[i + 1]];
            dst[i + 2] = lut[src[i + 2]];
            dst[i + 3] = src[i + 3];
        }
        ctx.putImageData(newImageData, 0, 0);
        setPreviewUrl(canvas.toDataURL('image/jpeg', 0.85));
    }, [points]);

    const drawGraph = () => {
        const canvas = graphCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 256);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, 255);
        ctx.lineTo(255, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 4; i++) {
            ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256);
            ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64);
        }
        ctx.stroke();
        const sorted = [...points].sort((a, b) => a.x - b.x);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sorted[0].x, sorted[0].y);
        for (let i = 1; i < sorted.length; i++) ctx.lineTo(sorted[i].x, sorted[i].y);
        ctx.stroke();
        sorted.forEach((p) => {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    };

    const handleGraphMouseDown = (e) => {
        const rect = graphCanvasRef.current.getBoundingClientRect();
        const scaleX = 256 / rect.width;
        const scaleY = 256 / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        const hit = points.findIndex(p => Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2) < 15);
        if (hit >= 0) setDragIdx(hit);
        else if (points.length < 10) {
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
        setPoints(prev => { const newPts = [...prev]; newPts[dragIdx] = { x, y }; return newPts; });
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-modal w-full max-w-3xl rounded-2xl relative overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
                <div className="px-6 py-4 border-b border-slate-700/50 shrink-0">
                    <h2 className="text-xl font-bold text-white">Curvas de Tono</h2>
                    <p className="text-xs text-slate-400 mt-1">Arrastra los puntos de la curva.</p>
                </div>
                <div className="p-6 flex flex-col gap-4 bg-slate-900 overflow-auto" style={{ flex: 1 }}>
                    <div className="flex flex-col items-center gap-1">
                        <div className="relative w-[200px] h-[200px] bg-black border border-slate-700 cursor-crosshair rounded">
                            <canvas ref={graphCanvasRef} width={256} height={256} onMouseDown={handleGraphMouseDown} onMouseMove={handleGraphMouseMove} onMouseUp={() => setDragIdx(-1)} onMouseLeave={() => setDragIdx(-1)} style={{ display: 'block', width: '100%', height: '100%' }} />
                        </div>
                        <div className="flex justify-between w-[200px] text-[9px] text-slate-500"><span>Sombras</span><span>Medios</span><span>Luces</span></div>
                    </div>
                    <div className="flex flex-col items-center gap-1" style={{ flex: 1, minHeight: 0 }}>
                        <div className="bg-slate-950 rounded border border-slate-800 w-full flex items-center justify-center overflow-hidden" style={{ height: '45vh', minHeight: 250 }}>
                            {previewUrl ? <img src={previewUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="Preview" /> : <span className="text-slate-500 text-xs">Cargando...</span>}
                        </div>
                        <span className="text-[10px] text-slate-400">Vista previa</span>
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-700/50 flex justify-between items-center bg-slate-900">
                    <button onClick={() => setPoints([{ x: 0, y: 255 }, { x: 255, y: 0 }])} className="text-xs text-slate-500 hover:text-white transition">Resetear</button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition">Cancelar</button>
                        <button onClick={() => { onApply(previewUrl); onClose(); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition font-medium">Aceptar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ExportModal = ({ onClose, onExport }) => {
    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-modal w-full max-w-sm rounded-2xl relative overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700/50"><h2 className="text-xl font-bold text-white">Exportar</h2></div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-300">La imagen se exportara en formato JPEG con calidad maxima.</p>
                </div>
                <div className="px-6 py-4 border-t border-slate-700/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm">Cancelar</button>
                    <button onClick={() => { onExport(); onClose(); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">Exportar</button>
                </div>
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
