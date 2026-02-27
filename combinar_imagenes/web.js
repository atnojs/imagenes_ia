/**
 * ============================================
 * 🎨 COMBINAR IMÁGENES - JavaScript
 * Aplicación para fusionar imágenes con IA
 * ============================================
 */

const CONFIG = {
    MAX_IMAGES: 10,
    MIN_IMAGES: 2,
    ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    PROXY_URL: 'proxy.php',
    INITIAL_SLOTS: 4
};

// --- HISTORIAL PERSISTENTE CON INDEXEDDB ---
const DB_NAME = 'combinar_imagenes_db';
const DB_VERSION = 1;
const STORE_NAME = 'history';

let db = null;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

async function loadHistoryFromStorage() {
    try {
        if (!db) await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => {
                const items = request.result || [];
                // Ordenar por timestamp descendente (más recientes primero)
                items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                resolve(items);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('Error cargando historial:', e);
        return [];
    }
}

async function saveItemToStorage(item) {
    try {
        if (!db) await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(item);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) { console.warn('Error guardando item:', e); }
}

async function deleteItemFromStorage(id) {
    try {
        if (!db) await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) { console.warn('Error eliminando item:', e); }
}

const state = {
    images: new Array(CONFIG.MAX_IMAGES).fill(null), // Array fijo con tamaño máximo, lleno de nulls inicialmente
    history: [],
    selectedAR: '1:1',
    isGenerating: false,
    isEnhancing: false,
    currentLightboxImage: null,
    promptOptions: []
};

const elements = {
    imagesGrid: document.getElementById('imagesGrid'),
    imageCounter: document.getElementById('imageCounter'),
    promptInput: document.getElementById('promptInput'),
    arSelector: document.getElementById('arSelector'),
    btnGenerate: document.getElementById('btnGenerate'),
    btnEnhance: document.getElementById('btnEnhance'),
    btnClearPrompt: document.getElementById('btnClearPrompt'),
    promptButtons: document.getElementById('promptButtons'),
    progressContainer: document.getElementById('loadingOverlay'),
    errorMessage: document.getElementById('errorMessage'),
    historySection: document.getElementById('historySection'),
    historyGrid: document.getElementById('historyGrid'),
    historyEmpty: document.getElementById('historyEmpty'),
    historyCount: document.getElementById('historyCount'),
    lightbox: document.getElementById('lightbox'),
    lightboxBackdrop: document.getElementById('lightboxBackdrop'),
    lightboxImg: document.getElementById('lightboxImg'),
    lightboxDownload: document.getElementById('lightboxDownload'),
    lightboxClose: document.getElementById('lightboxClose')
};

// ═══════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════

async function init() {
    // Cargar historial persistente desde IndexedDB
    try {
        await openDatabase();
        state.history = await loadHistoryFromStorage();
    } catch (e) {
        console.warn('Error inicializando historial:', e);
        state.history = [];
    }

    renderImageSlots();
    setupARSelector();
    setupPromptEnhancement();
    elements.btnGenerate.addEventListener('click', handleGenerate);
    setupLightbox();
    renderHistory(); // Renderizar historial cargado
    console.log('✅ Combinar Imágenes inicializado');
}

// ═══════════════════════════════════════════════
// GESTIÓN DE SLOTS DE IMÁGENES
// ═══════════════════════════════════════════════

function renderImageSlots() {
    elements.imagesGrid.innerHTML = '';

    // Contamos cuantos slots llenos hay para saber hasta dónde mostrar, 
    // pero siempre respetando un mínimo de INITIAL_SLOTS
    let lastFilledIndex = -1;
    for (let i = 0; i < state.images.length; i++) {
        if (state.images[i] !== null) {
            lastFilledIndex = i;
        }
    }

    const slotsToShow = Math.min(
        Math.max(lastFilledIndex + 2, CONFIG.INITIAL_SLOTS), // Muestra hasta el último lleno + 1 (para subir nueva)
        CONFIG.MAX_IMAGES
    );

    for (let i = 0; i < slotsToShow; i++) {
        const slot = createImageSlot(i);
        elements.imagesGrid.appendChild(slot);
    }

    updateImageCounter();
}

function createImageSlot(index) {
    const slot = document.createElement('div');
    slot.className = 'image-slot';
    slot.dataset.index = index;

    const isBackground = index === 0;
    if (isBackground) {
        slot.classList.add('background-slot');
    }

    const image = state.images[index];

    if (image) {
        slot.classList.add('filled');
        slot.innerHTML = `
            <div class="slot-preview">
                <img src="${image.preview}" alt="Imagen ${isBackground ? 'Fondo' : index}">
            </div>
            <div class="slot-actions">
                <button class="btn-remove" title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                    </svg>
                </button>
            </div>
            <span class="slot-label">${isBackground ? 'Fondo' : index}</span>
        `;

        slot.querySelector('.btn-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            removeImage(index);
        });

    } else {
        slot.innerHTML = `
            <svg class="slot-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M5 12h14"/>
                <path d="M12 5v14"/>
            </svg>
            <span class="slot-label">${isBackground ? 'Fondo' : index}</span>
        `;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = CONFIG.ALLOWED_TYPES.join(',');
        input.hidden = true;
        slot.appendChild(input);

        slot.addEventListener('click', () => input.click());

        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleImageFile(e.target.files[0], index);
            }
        });

        // Drag & Drop
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            slot.classList.add('dragover');
        });

        slot.addEventListener('dragleave', () => slot.classList.remove('dragover'));

        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleImageFile(e.dataTransfer.files[0], index);
            }
        });
    }

    return slot;
}

async function handleImageFile(file, index) {
    if (!CONFIG.ALLOWED_TYPES.includes(file.type)) {
        showError('Formato no válido. Usa: JPG, PNG o WebP');
        return;
    }

    try {
        const base64 = await fileToBase64(file);

        const imageData = {
            data: base64.split(',')[1],
            mimeType: file.type,
            preview: base64,
            isBackground: index === 0
        };

        // Asignación directa al índice correcto
        state.images[index] = imageData;

        // NO filtramos nulls para mantener posiciones fijas

        renderImageSlots();
        hideError();

    } catch (error) {
        showError('Error al procesar la imagen');
        console.error(error);
    }
}

function removeImage(index) {
    state.images[index] = null; // En lugar de splice, ponemos null para vaciar el slot
    renderImageSlots();
}

function updateImageCounter() {
    const filledCount = state.images.filter(img => img !== null).length;
    elements.imageCounter.textContent = `${filledCount}/${CONFIG.MAX_IMAGES}`;
}

// ═══════════════════════════════════════════════
// MEJORAR PROMPT CON IA (MULTIMODAL)
// ═══════════════════════════════════════════════

async function handleEnhancePrompt() {
    const prompt = elements.promptInput.value.trim();

    // Recopilar imágenes activas
    const activeImages = state.images
        .filter(img => img !== null)
        .map(img => ({
            data: img.data,
            mimeType: img.mimeType,
            isBackground: img.isBackground
        }));

    if (activeImages.length === 0 && !prompt) {
        showError('Sube imágenes o escribe un prompt');
        return;
    }

    setEnhancing(true);
    hideError();

    try {
        const hasBackground = activeImages.some(img => img.isBackground);

        const response = await fetch(CONFIG.PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task: 'enhancePrompt',
                prompt: prompt || "Describe y combina estas imágenes de forma creativa",
                hasBackground: hasBackground,
                images: activeImages // Enviamos las imágenes para contexto visual
            })
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error);

        if (data.options && data.options.length > 0) {
            state.promptOptions = data.options.slice(0, 4);
            showPromptButtons();
        } else {
            showError('No se pudieron generar opciones');
        }

    } catch (error) {
        showError(error.message || 'Error al mejorar el prompt');
        console.error('Error:', error);
    } finally {
        setEnhancing(false);
    }
}

// ... (Resto de funciones: setupPromptEnhancement, showPromptButtons, hidePromptButtons, setEnhancing, handleGenerate, setGenerating, addToHistory, renderHistory, createHistoryCard, downloadImage, regenerateImage, deleteFromHistory, setupLightbox, openLightbox, closeLightbox, fileToBase64, showError, hideError - SIN CAMBIOS IMPORTANTES)

function setupARSelector() {
    const buttons = elements.arSelector.querySelectorAll('.ar-option');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedAR = btn.dataset.ar;
        });
    });
}

function setupPromptEnhancement() {
    elements.btnEnhance.addEventListener('click', handleEnhancePrompt);
    elements.btnClearPrompt.addEventListener('click', () => {
        elements.promptInput.value = '';
        hidePromptButtons();
    });

    const promptBtns = elements.promptButtons.querySelectorAll('.prompt-btn');
    promptBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            if (state.promptOptions[index]) {
                promptBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                elements.promptInput.value = state.promptOptions[index];
            }
        });
    });
}

function showPromptButtons() {
    elements.promptButtons.classList.remove('hidden');
    elements.promptButtons.querySelectorAll('.prompt-btn').forEach(b => b.classList.remove('selected'));
}

function hidePromptButtons() {
    elements.promptButtons.classList.add('hidden');
    state.promptOptions = [];
}

function setEnhancing(isEnhancing) {
    state.isEnhancing = isEnhancing;
    elements.btnEnhance.disabled = isEnhancing;
    elements.btnEnhance.innerHTML = isEnhancing
        ? `<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Mejorando...`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21"/><path d="M17 3v4"/><path d="M21 5h-4"/></svg> Mejorar Prompt`;
}

async function handleGenerate() {
    // Filtrar imágenes reales (no null)
    const activeImages = state.images.filter(img => img !== null);

    if (activeImages.length < CONFIG.MIN_IMAGES) {
        showError(`Necesitas al menos ${CONFIG.MIN_IMAGES} imágenes para combinar`);
        return;
    }

    const prompt = elements.promptInput.value.trim();
    if (!prompt) {
        showError('Escribe instrucciones para la IA');
        return;
    }

    setGenerating(true);
    hideError();

    try {
        let backgroundImage = null;
        const imagesToProcess = [];
        const hasBackground = state.images[0] !== null; // Si el slot 0 está lleno, asumimos que es fondo

        // Procesar imágenes respetando roles
        activeImages.forEach(img => {
            if (img.isBackground) {
                backgroundImage = { data: img.data, mimeType: img.mimeType };
            } else {
                imagesToProcess.push({ data: img.data, mimeType: img.mimeType });
            }
        });

        const requestData = {
            task: 'combineImages',
            images: imagesToProcess,
            backgroundImage: backgroundImage,
            prompt: prompt,
            aspectRatio: state.selectedAR
        };

        const response = await fetch(CONFIG.PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error);

        if (data.images && data.images.length > 0) {
            data.images.forEach(img => {
                addToHistory({
                    data: img.data,
                    mimeType: img.mimeType || 'image/jpeg',
                    prompt: prompt,
                    aspectRatio: state.selectedAR,
                    hasBackground: !!backgroundImage,
                    timestamp: Date.now()
                });
            });
        }

    } catch (error) {
        showError(error.message || 'Error al generar las imágenes');
        console.error('Error de generación:', error);
    } finally {
        setGenerating(false);
    }
}

function setGenerating(isGenerating) {
    state.isGenerating = isGenerating;
    elements.btnGenerate.disabled = isGenerating;

    if (isGenerating) {
        elements.progressContainer.classList.remove('hidden');
    } else {
        elements.progressContainer.classList.add('hidden');
    }
}

function addToHistory(imageData) {
    imageData.id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    state.history.unshift(imageData);
    saveItemToStorage(imageData); // Persistir en IndexedDB
    renderHistory();
}

function renderHistory() {
    elements.historyCount.textContent = state.history.length;

    const existingCards = elements.historyGrid.querySelectorAll('.history-card');
    existingCards.forEach(card => card.remove());

    if (state.history.length === 0) {
        elements.historyEmpty.classList.remove('hidden');
        return;
    }

    elements.historyEmpty.classList.add('hidden');

    state.history.forEach(item => {
        const card = createHistoryCard(item);
        elements.historyGrid.appendChild(card);
    });
}

function createHistoryCard(item) {
    const card = document.createElement('div');
    card.className = 'history-card glass-hover';
    card.dataset.id = item.id;
    const imageUrl = `data:${item.mimeType};base64,${item.data}`;
    card.innerHTML = `
        <img src="${imageUrl}" alt="Imagen generada">
        <div class="card-overlay custom-overlay">
            <div class="overlay-buttons">
                 <button class="custom-action-btn regenerate" title="Regenerar">
                    <div class="btn-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                    </div>
                    <span class="btn-label">Regenerar</span>
                </button>
                <button class="custom-action-btn download" title="Descargar">
                    <div class="btn-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    </div>
                    <span class="btn-label">Descargar</span>
                </button>
                <button class="custom-action-btn delete" title="Eliminar">
                    <div class="btn-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </div>
                    <span class="btn-label">Eliminar</span>
                </button>
            </div>
        </div>
    `;

    // 🔧 FIX: permitir clic en botones del overlay sin disparar el zoom
    const overlay = card.querySelector('.card-overlay');
    if (overlay) {
        // Asegura que el overlay reciba eventos (si el CSS lo estaba bloqueando)
        overlay.style.pointerEvents = 'auto';

        // Click sobre el overlay (fuera de botones) mantiene el zoom
        overlay.addEventListener('click', (e) => {
            if (!e.target.closest('.custom-action-btn')) {
                openLightbox(item);
            }
        });

        // Cursor del overlay
        overlay.style.cursor = 'zoom-in';
    }

    // Asegura interacción/cursor en los botones del overlay
    card.querySelectorAll('.custom-action-btn').forEach((btn) => {
        btn.style.pointerEvents = 'auto';
        btn.style.cursor = 'pointer';
    });

    card.querySelector('img').addEventListener('click', () => openLightbox(item));
    card.querySelector('.download').addEventListener('click', (e) => { e.stopPropagation(); downloadImage(item); });
    card.querySelector('.regenerate').addEventListener('click', (e) => { e.stopPropagation(); regenerateImage(item); });
    card.querySelector('.delete').addEventListener('click', (e) => { e.stopPropagation(); deleteFromHistory(item.id); });
    return card;
}

function downloadImage(item) {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${item.data}`;
    link.download = `combinacion_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function regenerateImage(item) {
    elements.promptInput.value = item.prompt;
    const arButtons = elements.arSelector.querySelectorAll('.ar-option');
    arButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.ar === item.aspectRatio));
    state.selectedAR = item.aspectRatio;
    elements.promptInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => handleGenerate(), 500);
}

function deleteFromHistory(id) {
    const index = state.history.findIndex(item => item.id === id);
    if (index !== -1) {
        state.history.splice(index, 1);
        deleteItemFromStorage(id); // Eliminar de IndexedDB
        renderHistory();
    }
}

function setupLightbox() {
    elements.lightboxBackdrop.addEventListener('click', closeLightbox);
    elements.lightboxClose.addEventListener('click', closeLightbox);
    elements.lightboxImg.addEventListener('click', closeLightbox); // Click en imagen también cierra
    elements.lightboxDownload.addEventListener('click', () => {
        if (state.currentLightboxImage) downloadImage(state.currentLightboxImage);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !elements.lightbox.classList.contains('hidden')) closeLightbox();
    });
}

function openLightbox(item) {
    state.currentLightboxImage = item;
    const imageUrl = `data:${item.mimeType};base64,${item.data}`;
    elements.lightboxImg.src = imageUrl;
    elements.lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    elements.lightbox.classList.add('hidden');
    state.currentLightboxImage = null;
    document.body.style.overflow = '';
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsDataURL(file);
    });
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
}

function hideError() {
    elements.errorMessage.classList.add('hidden');
}

const style = document.createElement('style');
style.textContent = `.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', init);
