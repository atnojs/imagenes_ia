document.addEventListener('DOMContentLoaded', () => {
    // =========================================
    // STATE
    // =========================================
    const state = {
        images: {
            A: { img: null, src: null, x: 0, y: 0, scale: 1, rotate: 0, bw: false },
            B: { img: null, src: null, x: 0, y: 0, scale: 1, rotate: 0, bw: false }
        },
        settings: {
            transparency: 50,
            blendMode: 'normal',
            swapOrder: false 
        },
        canvas: {
            activeLayer: 'A',
            isDragging: false,
            lastX: 0,
            lastY: 0
        },
        history: []
    };

    // =========================================
    // ELEMENTS
    // =========================================
    const elements = {
        canvas: document.getElementById('mainCanvas'),
        canvasWrapper: document.getElementById('canvasWrapper'),
        ctx: document.getElementById('mainCanvas').getContext('2d'),
        
        previewContA: document.getElementById('previewContA'),
        previewContB: document.getElementById('previewContB'),
        
        fileInputA: document.getElementById('fileInputA'),
        fileInputB: document.getElementById('fileInputB'),
        dropZoneA: document.getElementById('dropZoneA'),
        dropZoneB: document.getElementById('dropZoneB'),
        previewA: document.getElementById('previewA'),
        previewB: document.getElementById('previewB'),
        
        controlsA: document.getElementById('controlsA'),
        controlsB: document.getElementById('controlsB'),
        transparencySlider: document.getElementById('transparencySlider'),
        transparencyValue: document.getElementById('transparencyValue'),
        blendModeSelect: document.getElementById('blendModeSelect'),
        
        btnSwap: document.getElementById('btnSwap'),
        btnReset: document.getElementById('btnReset'),
        btnGenerateAI: document.getElementById('btnGenerateAI'),
        btnAddToHistory: document.getElementById('btnAddToHistory'),
        btnOpenHistory: document.getElementById('btnOpenHistory'),
        
        aiLoading: document.getElementById('aiLoading'),
        historyModal: document.getElementById('historyModal'),
        btnCloseHistory: document.getElementById('btnCloseHistory'),
        historyTrack: document.getElementById('historyTrack'),
        
        quickTransBtns: document.querySelectorAll('[data-set-trans]'),
        exportBtns: document.querySelectorAll('.export-dropdown button[data-quality]')
    };

    // =========================================
    // FUNCIONES PRINCIPALES CORREGIDAS
    // =========================================

    // 1. AJUSTAR CANVAS PARA VER IMÁGENES COMPLETAS
    const adjustCanvasLayout = () => {
        const wrapperRect = elements.canvasWrapper.getBoundingClientRect();
        
        // Tamaño del canvas será el tamaño del contenedor (para visualización)
        const displayWidth = wrapperRect.width - 40; // -40px de margen
        const displayHeight = wrapperRect.height - 40;
        
        // Configurar canvas para visualización
        elements.canvas.style.width = displayWidth + 'px';
        elements.canvas.style.height = displayHeight + 'px';
        elements.canvas.style.objectFit = 'contain';
        
        // Pero mantener tamaño interno alto para exportación
        let internalWidth = Math.max(displayWidth, 800);
        let internalHeight = Math.max(displayHeight, 600);
        
        // Si hay imágenes, usar su tamaño como mínimo
        if (state.images.A.img) {
            internalWidth = Math.max(internalWidth, state.images.A.img.width);
            internalHeight = Math.max(internalHeight, state.images.A.img.height);
        }
        if (state.images.B.img) {
            internalWidth = Math.max(internalWidth, state.images.B.img.width);
            internalHeight = Math.max(internalHeight, state.images.B.img.height);
        }
        
        elements.canvas.width = internalWidth;
        elements.canvas.height = internalHeight;
        
        // Centrar imágenes si es necesario
        if (state.images.A.img) centerImage('A');
        if (state.images.B.img) centerImage('B');
        
        drawCanvas();
    };

    const centerImage = (side) => {
        if (!state.images[side].img) return;
        
        const img = state.images[side].img;
        const scaledWidth = img.width * state.images[side].scale;
        const scaledHeight = img.height * state.images[side].scale;
        
        state.images[side].x = (elements.canvas.width - scaledWidth) / 2;
        state.images[side].y = (elements.canvas.height - scaledHeight) / 2;
    };

    // 2. CARGAR IMAGEN
    const handleImageLoad = (file, side) => {
        if (!file || !file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                state.images[side].img = img;
                state.images[side].src = e.target.result;
                state.images[side].scale = 1;
                state.images[side].rotate = 0;
                state.images[side].bw = false;
                
                // Actualizar preview
                elements[`preview${side}`].src = e.target.result;
                elements[`previewCont${side}`].classList.remove('hidden');
                elements[`dropZone${side}`].classList.add('hidden');
                elements[`controls${side}`].classList.remove('disabled');
                
                // Resetear controles
                document.getElementById(`scale${side}`).value = 1;
                document.getElementById(`rotate${side}`).value = 0;
                document.getElementById(`btnBW${side}`).classList.remove('primary');
                
                // Activar capa y centrar
                state.canvas.activeLayer = side;
                updateActiveVisuals();
                centerImage(side);
                
                adjustCanvasLayout();
                checkGenerateReady();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    // 3. DIBUJAR CANVAS
    const drawCanvas = () => {
        const ctx = elements.ctx;
        const width = elements.canvas.width;
        const height = elements.canvas.height;
        
        // Limpiar canvas
        ctx.clearRect(0, 0, width, height);
        
        // Determinar capas según orden
        const bottomSide = state.settings.swapOrder ? 'B' : 'A';
        const topSide = state.settings.swapOrder ? 'A' : 'B';
        const imgBottom = state.images[bottomSide];
        const imgTop = state.images[topSide];
        
        // Función para dibujar una capa
        const drawLayer = (layer, side) => {
            if (!layer.img) return;
            
            ctx.save();
            
            // Calcular centro de transformación
            const centerX = layer.x + (layer.img.width * layer.scale) / 2;
            const centerY = layer.y + (layer.img.height * layer.scale) / 2;
            
            // Aplicar transformaciones
            ctx.translate(centerX, centerY);
            ctx.rotate(layer.rotate * Math.PI / 180);
            ctx.scale(layer.scale, layer.scale);
            ctx.translate(-centerX, -centerY);
            
            // Aplicar filtro B/N si está activado
            if (layer.bw) {
                ctx.filter = 'grayscale(100%)';
            }
            
            // Dibujar imagen
            ctx.drawImage(
                layer.img,
                layer.x,
                layer.y,
                layer.img.width,
                layer.img.height
            );
            
            ctx.restore();
        };
        
        // Dibujar capa inferior
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'normal';
        drawLayer(imgBottom, bottomSide);
        
        // Dibujar capa superior con transparencia
        if (imgTop.img) {
            let opacity = state.settings.swapOrder 
                ? (100 - state.settings.transparency) / 100 
                : state.settings.transparency / 100;
            
            ctx.globalAlpha = opacity;
            ctx.globalCompositeOperation = state.settings.blendMode;
            drawLayer(imgTop, topSide);
        }
    };

    // 4. EXPORTAR IMAGEN CORRECTAMENTE
    const exportCanvas = (quality = 1.0) => {
        // Crear un canvas temporal con el tamaño COMPLETO
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Usar el tamaño interno del canvas principal (que es grande)
        tempCanvas.width = elements.canvas.width;
        tempCanvas.height = elements.canvas.height;
        
        // Dibujar el contenido actual en el canvas temporal
        tempCtx.drawImage(elements.canvas, 0, 0);
        
        // Crear enlace de descarga
        const link = document.createElement('a');
        link.download = `fusion-${quality === 1.0 ? 'alta' : quality === 0.8 ? 'media' : 'baja'}-calidad.jpg`;
        link.href = tempCanvas.toDataURL('image/jpeg', quality);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 5. AGREGAR AL HISTORIAL
    const addToHistory = (dataUrl, type) => {
        const item = {
            data: dataUrl,
            type: type,
            time: new Date().toLocaleTimeString()
        };
        
        state.history.unshift(item);
        
        // Crear elemento visual
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `<img src="${dataUrl}" alt="Historial ${type}">`;
        
        div.addEventListener('click', () => {
            const img = new Image();
            img.onload = () => {
                // Cargar en capa A
                state.images.A.img = img;
                state.images.A.src = dataUrl;
                state.images.A.scale = 1;
                state.images.A.rotate = 0;
                state.images.A.bw = false;
                
                // Actualizar UI
                elements.previewA.src = dataUrl;
                elements.previewContA.classList.remove('hidden');
                elements.dropZoneA.classList.add('hidden');
                elements.controlsA.classList.remove('disabled');
                
                // Resetear controles
                document.getElementById('scaleA').value = 1;
                document.getElementById('rotateA').value = 0;
                document.getElementById('btnBWA').classList.remove('primary');
                
                // Limpiar capa B
                state.images.B.img = null;
                state.images.B.src = null;
                elements.previewContB.classList.add('hidden');
                elements.dropZoneB.classList.remove('hidden');
                elements.controlsB.classList.add('disabled');
                
                // Redibujar
                centerImage('A');
                drawCanvas();
                
                // Cerrar modal
                elements.historyModal.classList.add('hidden');
            };
            img.src = dataUrl;
        });
        
        // Agregar al DOM
        const track = elements.historyTrack;
        const emptyMsg = track.querySelector('.empty-msg');
        if (emptyMsg) {
            track.innerHTML = '';
        }
        
        track.prepend(div);
    };

    // 6. INICIALIZAR EVENTOS
    const initListeners = () => {
        // Seleccionar capas
        document.getElementById('sideA').addEventListener('click', () => {
            if (state.images.A.img) {
                state.canvas.activeLayer = 'A';
                updateActiveVisuals();
            }
        });
        
        document.getElementById('sideB').addEventListener('click', () => {
            if (state.images.B.img) {
                state.canvas.activeLayer = 'B';
                updateActiveVisuals();
            }
        });

        // Para cada lado (A y B)
        ['A', 'B'].forEach(side => {
            const dz = elements[`dropZone${side}`];
            const fi = elements[`fileInput${side}`];

            // Click en dropzone
            dz.addEventListener('click', (e) => {
                e.stopPropagation();
                fi.click();
            });

            // Cambio en input de archivo
            fi.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    handleImageLoad(e.target.files[0], side);
                }
            });

            // Drag and drop
            dz.addEventListener('dragover', (e) => {
                e.preventDefault();
                dz.style.borderColor = 'var(--primary-color)';
            });

            dz.addEventListener('dragleave', () => {
                dz.style.borderColor = '';
            });

            dz.addEventListener('drop', (e) => {
                e.preventDefault();
                dz.style.borderColor = '';
                if (e.dataTransfer.files[0]) {
                    handleImageLoad(e.dataTransfer.files[0], side);
                }
            });

            // Botón cerrar
            document.querySelector(`.btn-close[data-target="${side}"]`).addEventListener('click', (e) => {
                e.stopPropagation();
                state.images[side].img = null;
                state.images[side].src = null;
                
                elements[`previewCont${side}`].classList.add('hidden');
                elements[`dropZone${side}`].classList.remove('hidden');
                elements[`controls${side}`].classList.add('disabled');
                
                adjustCanvasLayout();
                checkGenerateReady();
            });

            // Controles individuales
            document.getElementById(`scale${side}`).addEventListener('input', (e) => {
                state.images[side].scale = parseFloat(e.target.value);
                centerImage(side);
                drawCanvas();
            });

            document.getElementById(`rotate${side}`).addEventListener('input', (e) => {
                state.images[side].rotate = parseInt(e.target.value);
                drawCanvas();
            });

            document.getElementById(`btnBW${side}`).addEventListener('click', function(e) {
                e.stopPropagation();
                state.images[side].bw = !state.images[side].bw;
                this.classList.toggle('primary', state.images[side].bw);
                drawCanvas();
            });
        });

        // Controles globales
        elements.transparencySlider.addEventListener('input', (e) => {
            state.settings.transparency = e.target.value;
            elements.transparencyValue.textContent = `${100 - e.target.value}% / ${e.target.value}%`;
            drawCanvas();
        });

        elements.blendModeSelect.addEventListener('change', (e) => {
            state.settings.blendMode = e.target.value;
            drawCanvas();
        });

        elements.btnSwap.addEventListener('click', () => {
            state.settings.swapOrder = !state.settings.swapOrder;
            drawCanvas();
        });

        elements.btnReset.addEventListener('click', () => {
            // Resetear configuraciones
            state.settings.transparency = 50;
            state.settings.blendMode = 'normal';
            state.settings.swapOrder = false;
            
            elements.transparencySlider.value = 50;
            elements.transparencyValue.textContent = '50% / 50%';
            elements.blendModeSelect.value = 'normal';
            
            // Resetear imágenes
            ['A', 'B'].forEach(side => {
                if (state.images[side].img) {
                    state.images[side].scale = 1;
                    state.images[side].rotate = 0;
                    state.images[side].bw = false;
                    
                    document.getElementById(`scale${side}`).value = 1;
                    document.getElementById(`rotate${side}`).value = 0;
                    document.getElementById(`btnBW${side}`).classList.remove('primary');
                    
                    centerImage(side);
                }
            });
            
            drawCanvas();
        });

        // Botones de transparencia rápida
        elements.quickTransBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.dataset.setTrans;
                elements.transparencySlider.value = value;
                state.settings.transparency = parseInt(value);
                elements.transparencyValue.textContent = `${100 - value}% / ${value}%`;
                drawCanvas();
            });
        });

        // Arrastrar imágenes en canvas
        elements.canvas.addEventListener('mousedown', (e) => {
            if (!state.images[state.canvas.activeLayer].img) return;
            
            state.canvas.isDragging = true;
            state.canvas.lastX = e.clientX;
            state.canvas.lastY = e.clientY;
            elements.canvas.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!state.canvas.isDragging || !state.images[state.canvas.activeLayer].img) return;
            
            const scaleFactor = elements.canvas.width / elements.canvas.offsetWidth;
            const dx = (e.clientX - state.canvas.lastX) * scaleFactor;
            const dy = (e.clientY - state.canvas.lastY) * scaleFactor;
            
            state.images[state.canvas.activeLayer].x += dx;
            state.images[state.canvas.activeLayer].y += dy;
            
            state.canvas.lastX = e.clientX;
            state.canvas.lastY = e.clientY;
            
            drawCanvas();
        });

        window.addEventListener('mouseup', () => {
            state.canvas.isDragging = false;
            elements.canvas.style.cursor = 'default';
        });

        // Redimensionar ventana
        window.addEventListener('resize', adjustCanvasLayout);

        // Botón IA (simulación)
        elements.btnGenerateAI.addEventListener('click', () => {
            if (state.images.A.img && state.images.B.img) {
                elements.aiLoading.classList.remove('hidden');
                setTimeout(() => {
                    elements.aiLoading.classList.add('hidden');
                    alert('Fusión con IA completada (simulación)');
                }, 1500);
            }
        });

        // Agregar al historial
        elements.btnAddToHistory.addEventListener('click', () => {
            if (state.images.A.img || state.images.B.img) {
                // Crear canvas temporal para alta calidad
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                tempCanvas.width = elements.canvas.width;
                tempCanvas.height = elements.canvas.height;
                tempCtx.drawImage(elements.canvas, 0, 0);
                
                const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.95);
                addToHistory(dataUrl, 'Manual');
                
                alert('Imagen guardada en el historial');
            }
        });

        // Abrir/Cerrar historial
        elements.btnOpenHistory.addEventListener('click', () => {
            elements.historyModal.classList.remove('hidden');
        });

        elements.btnCloseHistory.addEventListener('click', () => {
            elements.historyModal.classList.add('hidden');
        });

        // Cerrar historial haciendo clic fuera
        elements.historyModal.addEventListener('click', (e) => {
            if (e.target === elements.historyModal) {
                elements.historyModal.classList.add('hidden');
            }
        });

        // Botones de exportación - ¡ESTOS AHORA FUNCIONAN!
        elements.exportBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (state.images.A.img || state.images.B.img) {
                    const quality = parseFloat(btn.dataset.quality);
                    exportCanvas(quality);
                } else {
                    alert('No hay imágenes para exportar');
                }
            });
        });
    };

    // 7. FUNCIONES UTILITARIAS
    const checkGenerateReady = () => {
        const hasBothImages = state.images.A.img && state.images.B.img;
        elements.btnGenerateAI.classList.toggle('disabled', !hasBothImages);
    };

    const updateActiveVisuals = () => {
        // Quitar highlight de ambos
        elements.previewContA.classList.remove('active-layer-neon');
        elements.previewContB.classList.remove('active-layer-neon');
        
        // Aplicar highlight al activo
        if (state.canvas.activeLayer === 'A' && state.images.A.img) {
            elements.previewContA.classList.add('active-layer-neon');
        } else if (state.canvas.activeLayer === 'B' && state.images.B.img) {
            elements.previewContB.classList.add('active-layer-neon');
        }
    };

    // =========================================
    // INICIALIZAR
    // =========================================
    initListeners();
    adjustCanvasLayout();
    
    // Inicializar canvas con color de fondo
    const ctx = elements.ctx;
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
});