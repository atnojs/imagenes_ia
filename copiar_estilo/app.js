// --- CONSTANTES DE FORMATO ---
const AspectRatio = { SQUARE: '1:1', PORTRAIT: '3:4', WIDE: '16:9', TALL: '9:16', ULTRAWIDE: '21:9' };
const STORAGE_KEY = 'copiar_estilo_history';

// Estado del historial
let history = [];

const getClosestAspectRatio = (width, height) => {
    const ratio = width / height;
    const targets = [
        { id: AspectRatio.SQUARE, val: 1 },
        { id: AspectRatio.PORTRAIT, val: 3 / 4 },
        { id: AspectRatio.WIDE, val: 16 / 9 },
        { id: AspectRatio.TALL, val: 9 / 16 },
        { id: AspectRatio.ULTRAWIDE, val: 21 / 9 }
    ];
    return targets.reduce((prev, curr) => Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev).id;
};

// Variable para guardar el AR detectado de la referencia
let detectedAR = AspectRatio.SQUARE;

// Función auxiliar para convertir File a Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result;
            const base64Data = result.split(',')[1];
            const mimeType = result.split(';')[0].split(':')[1];
            resolve({ data: base64Data, mimeType: mimeType });
        };
        reader.onerror = error => reject(error);
    });
}

// Lógica de previsualización mejorada
function setupPreview(inputId, imgId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = document.getElementById(imgId);
                img.src = e.target.result;
                img.style.display = 'block';

                // Si es la imagen de referencia (styleInput), detectamos su AR
                if (inputId === 'styleInput') {
                    const tempImg = new Image();
                    tempImg.onload = () => {
                        detectedAR = getClosestAspectRatio(tempImg.width, tempImg.height);
                        console.log("Aspect Ratio detectado:", detectedAR);
                    };
                    tempImg.src = e.target.result;
                }

                // Ocultar iconos de subida
                if (img.parentElement) {
                    img.parentElement.querySelectorAll('.upload-icon, span').forEach(el => el.style.opacity = '0');
                }
            }
            reader.readAsDataURL(file);
        }
    });
}

setupPreview('styleInput', 'stylePreview');
setupPreview('subjectInput', 'subjectPreview');

// =============================================
// HISTORIAL PERSISTENTE
// =============================================
function loadHistory() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                history = parsed;
                renderHistory();
            }
        }
    } catch (e) {
        console.warn('Error cargando historial:', e);
    }
}

function saveHistory() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
        console.warn('Error guardando historial:', e);
    }
}

function addToHistory(imageData) {
    const item = {
        id: Date.now(),
        src: imageData,
        date: new Date().toLocaleString()
    };
    history.unshift(item);
    saveHistory();
    renderHistory();
}

function removeFromHistory(id) {
    history = history.filter(item => item.id !== id);
    saveHistory();
    renderHistory();
}

function downloadHistoryImage(id) {
    const item = history.find(h => h.id === id);
    if (!item) return;

    const link = document.createElement('a');
    link.href = item.src;
    link.download = `fusion-ai-${id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function clearHistory() {
    if (!confirm('¿Estás seguro de que quieres borrar todo el historial?')) return;
    history = [];
    saveHistory();
    renderHistory();
}

function renderHistory() {
    const grid = document.getElementById('historyGrid');
    const section = document.getElementById('historySection');

    if (!grid) return;

    if (history.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    grid.innerHTML = history.map(item => `
        <div class="history-card">
            <img src="${item.src}" alt="Historial" onclick="openLightbox('${item.src.replace(/'/g, "\\'")}')">
            <div class="history-actions">
                <button onclick="event.stopPropagation(); downloadHistoryImage(${item.id})">📥</button>
                <button class="btn-delete" onclick="event.stopPropagation(); removeFromHistory(${item.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

// =============================================
// LIGHTBOX / ZOOM
// =============================================
function openLightbox(src) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');

    lightboxImg.src = src;
    lightbox.classList.remove('hidden');
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.classList.add('hidden');
}

function downloadLightboxImage() {
    const lightboxImg = document.getElementById('lightbox-img');
    if (!lightboxImg.src) return;

    const link = document.createElement('a');
    link.href = lightboxImg.src;
    link.download = `fusion-ai-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Cerrar lightbox al hacer clic (excepto en controles)
document.addEventListener('DOMContentLoaded', () => {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target.closest('.lightbox-controls')) return;
            closeLightbox();
        });
    }

    // Cargar historial al iniciar
    loadHistory();
});

// Cerrar lightbox con Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
});

// =============================================
// GENERACIÓN DE IMÁGENES
// =============================================
async function generateImage() {
    const styleFile = document.getElementById('styleInput').files[0];
    const subjectFile = document.getElementById('subjectInput').files[0];
    const btn = document.getElementById('generateBtn');
    const loading = document.getElementById('loadingOverlay');
    const placeholder = document.querySelector('.placeholder-text');
    const resultsGrid = document.getElementById('resultsGrid');
    const resultTxt = document.getElementById('resultText');

    if (!styleFile || !subjectFile) {
        alert("Por favor sube ambas imágenes.");
        return;
    }

    // UI Updates
    btn.disabled = true;
    placeholder.style.display = 'none';
    resultsGrid.innerHTML = '';
    resultTxt.innerHTML = '';

    // Configurar fondo dinámico del overlay (usando la imagen de referencia)
    const loadingBg = document.getElementById('loadingBgImage');
    const stylePreview = document.getElementById('stylePreview');
    if (stylePreview && stylePreview.src && stylePreview.style.display !== 'none') {
        loadingBg.style.backgroundImage = `url(${stylePreview.src})`;
    } else {
        loadingBg.style.backgroundImage = 'none';
    }

    loading.style.display = 'flex';

    try {
        const styleData = await fileToBase64(styleFile);
        const subjectData = await fileToBase64(subjectFile);

        // Función para hacer una llamada a la API
        const callAPI = async (variationNum) => {
            const promptText = `
Actúa como un motor de edición fotográfica de alta gama. Tu tarea es REEMPLAZAR elementos específicos quirúrgicamente.
DEFINICIÓN DE ROLES:
- Input A [REFERENCIA_ESCENA]: Provee ESCENARIO, ILUMINACIÓN, POSE y ÁNGULO.
- Input B [REFERENCIA_ACTIVO]: Provee IDENTIDAD FACIAL y VESTUARIO.
MISIÓN: El Sujeto B (con su cara y ropa) posando EXACTO como el Sujeto A.
IMPORTANTE: El resultado debe respetar el formato de imagen de la referencia A.
Esta es la variación número ${variationNum}. Genera una interpretación única.
            `;

            const payload = {
                model: "gemini-3-pro-image-preview",
                contents: [
                    {
                        parts: [
                            { text: promptText },
                            { inlineData: { mimeType: styleData.mimeType, data: styleData.data } },
                            { inlineData: { mimeType: subjectData.mimeType, data: subjectData.data } }
                        ]
                    }
                ],
                generationConfig: {
                    responseModalities: ["IMAGE"],
                    imageConfig: {
                        aspectRatio: detectedAR
                    }
                }
            };

            const response = await fetch('proxy.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            return response.json();
        };

        // Ejecutar 2 llamadas en paralelo
        const [data1, data2] = await Promise.all([callAPI(1), callAPI(2)]);

        loading.style.display = 'none';
        btn.disabled = false;

        let imageCount = 0;

        // Procesar resultados de ambas llamadas
        for (const data of [data1, data2]) {
            if (data.candidates?.[0]?.content?.parts) {
                const parts = data.candidates[0].content.parts;

                for (const part of parts) {
                    if (part.inlineData) {
                        const imgSrc = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        const cardHtml = `
                            <div class="result-card">
                                <img src="${imgSrc}" alt="Resultado ${imageCount + 1}" onclick="openLightbox('${imgSrc.replace(/'/g, "\\'")}')">
                                <div class="card-actions">
                                    <button onclick="event.stopPropagation(); exportImage('${imgSrc.replace(/'/g, "\\'")}')">📥 Exportar</button>
                                    <button onclick="event.stopPropagation(); addToHistory('${imgSrc.replace(/'/g, "\\'")}')">➕ Historial</button>
                                </div>
                            </div>
                        `;
                        resultsGrid.innerHTML += cardHtml;
                        imageCount++;
                    } else if (part.text) {
                        resultTxt.innerHTML += part.text + '<br>';
                    }
                }
            } else if (data.error) {
                resultTxt.innerHTML += "Error: " + JSON.stringify(data.error) + '<br>';
            }
        }

        if (imageCount === 0) {
            resultTxt.innerHTML = "No se generaron imágenes.";
        }

    } catch (error) {
        console.error(error);
        loading.style.display = 'none';
        btn.disabled = false;
        resultTxt.innerHTML = "Error: " + error.message;
    }
}

function exportImage(imgSrc) {
    const link = document.createElement('a');
    link.href = imgSrc;
    link.download = `fusion-ai-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportResult() {
    // Función legacy por compatibilidad
    const img = document.querySelector('#resultsGrid .result-card img');
    if (img) exportImage(img.src);
}
