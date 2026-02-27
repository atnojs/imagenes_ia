import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import * as Lucide from 'lucide-react';

const {
    Sparkles, Wand2, ChevronLeft, X, Upload, Send,
    Loader2, LayoutGrid, History, Info, Image: ImageIcon,
    Square, RectangleHorizontal, RectangleVertical,
    Monitor, Smartphone, Key, ExternalLink,
    Trash2, RefreshCw, MessageSquare, Download, Share2
} = Lucide;

// --- CONSTANTES (ORIGINAL) ---
const AspectRatio = { SQUARE: '1:1', PORTRAIT: '3:4', WIDE: '16:9', TALL: '9:16', ULTRAWIDE: '21:9' };
const ImageSize = { SIZE_1K: '1K', SIZE_2K: '2K', SIZE_4K: '4K' };

const STYLE_PRESETS = [
    { id: 'default', name: 'Original', promptSuffix: '' },
    { id: 'lego', name: 'LEGO', promptSuffix: 'in the style of high-quality LEGO bricks and minifigures, detailed plastic texture' },
    { id: 'pixel-art', name: 'Pixel Art', promptSuffix: '16-bit pixel art style, retro video game aesthetic, vibrant colors' },
    { id: 'comic', name: 'Comic Americano', promptSuffix: 'Transforma esta imagen en una viñeta de cómic americano clásico estilo Marvel/DC. Dirección artística obligatoria: Contornos de líneas negras gruesas y limpias, con variación de grosor para dar dinamismo. Personajes con musculatura definida y anatomía heroica, poses potentes y expresivas. Colores vivos y contrastados, claramente separados por áreas. Sombreado y textura: Sombras marcadas y dramáticas, priorizando el volumen. Uso visible de patrones halftone (puntos) para sombras y degradados. Evita degradados suaves o realistas; el sombreado debe ser gráfico. Composición de cómic: Lectura clara tipo viñeta, con énfasis en acción y narrativa visual. Siluetas fuertes y fondos simplificados cuando sea necesario para destacar al personaje. Referencias claras: Estilo Marvel/DC clásico y moderno (cómic impreso, no digital). Reglas: Reinterpreta la imagen como ilustración de cómic, no como foto retocada. Mantén la composición y elementos clave de la escena original. El resultado debe parecer una viñeta profesional lista para publicación, no un filtro de color aplicado sobre una foto.' },
    { id: 'mortadelo', name: 'Mortadelo y Filemon', promptSuffix: 'in the unmistakable cartoon style of Francisco Ibanez, slapstick aesthetic, humorous caricatures' },
    { id: 'clay', name: 'Plastilina', promptSuffix: 'claymation style, handcrafted plasticine textures, stop-motion look' },
    { id: 'cyberpunk', name: 'Cyberpunk', promptSuffix: 'futuristic neon aesthetic, dark atmosphere, glowing lights, high-tech low-life' },
    { id: 'ghibli', name: 'Studio Ghibli', promptSuffix: 'Studio Ghibli anime style, painterly backgrounds, whimsical atmosphere, soft lighting' },
    { id: 'custom', name: 'Texto Personalizado', promptSuffix: '' }
];

const ASPECT_RATIOS = [
    { id: AspectRatio.SQUARE, name: '1:1', icon: <Square size={18} /> },
    { id: AspectRatio.PORTRAIT, name: '3:4', icon: <RectangleVertical size={18} /> },
    { id: AspectRatio.WIDE, name: '16:9', icon: <Monitor size={18} /> },
    { id: AspectRatio.TALL, name: '9:16', icon: <Smartphone size={18} /> },
    { id: AspectRatio.ULTRAWIDE, name: '21:9', icon: <Smartphone size={18} /> },
];

// --- SERVICES (ORIGINAL LOGIC) ---
const PROXY_URL = './proxy.php';

const callProxy = async (model, contents, config = {}) => {
    const payload = { model, contents, ...config };
    const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Error ${response.status}: ${text}`);
    }
    return await response.json();
};

const enhancePrompt = async (basePrompt) => {
    try {
        const contents = [{ parts: [{ text: `Mejora este prompt para generación de imágenes: "${basePrompt}". Genera 4 versiones diferentes en español: Descriptiva, Cinematográfica, Artística, y Minimalista.` }] }];
        const config = {
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: { type: { type: "STRING" }, text: { type: "STRING" } },
                        required: ["type", "text"]
                    }
                }
            }
        };
        const result = await callProxy('gemini-3-flash-preview', contents, config);
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text ? JSON.parse(text) : [];
    } catch (e) {
        console.error("Failed to enhance prompt", e);
        return [];
    }
};

const generateImage = async (params) => {
    let basePrompt = params.prompt || '';
    const styleSuffix = params.styleSuffix || '';

    // Si hay imagen fuente (remix), usar prompt de outpainting probado
    let finalPrompt = '';
    if (params.sourceImage) {
        // Prompt simple y efectivo basado en el codigo que funciona
        const outpaintingPrompt = `Adjust the aspect ratio of this image to ${params.aspectRatio}. If there are new empty areas created by this format change, generate new content that fills them seamlessly, maintaining the style, lighting, and context of the original image (Outpainting). The result should look like a complete, natural image.`;

        // Combinar con prompt del usuario si existe
        if (basePrompt.trim()) {
            finalPrompt = `${outpaintingPrompt} Additional context: ${basePrompt} ${styleSuffix}`.trim();
        } else {
            finalPrompt = outpaintingPrompt;
        }
    } else {
        // Generacion normal sin imagen fuente
        finalPrompt = `${basePrompt} ${styleSuffix}`.trim();
    }

    const parts = [{ text: finalPrompt }];
    if (params.sourceImage) {
        const base64Data = params.sourceImage.split(',')[1];
        parts.push({ inlineData: { data: base64Data, mimeType: "image/png" } });
    }
    const contents = [{ parts }];
    const config = { generationConfig: { imageConfig: { aspectRatio: params.aspectRatio } } };
    const result = await callProxy('gemini-3-pro-image-preview', contents, config);
    const partsResponse = result?.candidates?.[0]?.content?.parts || [];
    for (const part of partsResponse) {
        if (part.inlineData) return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
    throw new Error("No se pudo generar la imagen");
};

const editImageConversation = async (params) => {
    const base64Data = params.originalImage.split(',')[1];
    const contents = [{
        parts: [
            { inlineData: { data: base64Data, mimeType: "image/png" } },
            { text: params.instruction }
        ]
    }];
    const config = { generationConfig: { imageConfig: { aspectRatio: params.aspectRatio } } };
    const result = await callProxy('gemini-3-pro-image-preview', contents, config);
    const partsResponse = result?.candidates?.[0]?.content?.parts || [];
    for (const part of partsResponse) {
        if (part.inlineData) return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
    throw new Error("Error en la edición conversacional");
};

// --- COMPONENTS ---

const ApiKeyChecker = ({ children }) => <>{children}</>;

// Componente CustomSelect para reemplazar el dropdown nativo
const CustomSelect = ({ options, value, onChange, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(opt => opt.id === value) || options[0];
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={dropdownRef} className={`relative ${className || ''}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-black/20 border border-white/5 rounded-3xl p-4 text-xs outline-none cursor-pointer text-left flex items-center justify-between hover:border-cyan-400/50 focus:border-cyan-400 transition-all"
            >
                <span className="text-gray-200">{selectedOption.name}</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 glass rounded-2xl border border-cyan-500/20 overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {options.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => {
                                    onChange(opt.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-4 py-3 text-left text-xs transition-all flex items-center gap-3 ${opt.id === value
                                    ? 'bg-cyan-500/20 text-cyan-400 border-l-2 border-cyan-400'
                                    : 'text-gray-300 hover:bg-white/5 hover:text-cyan-400 border-l-2 border-transparent'
                                    }`}
                            >
                                {opt.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const ImageCard = ({ image, onDelete, onRegenerate, onEdit, onClick }) => {
    const handleDownload = (e) => {
        e.stopPropagation();
        const link = document.createElement('a');
        link.href = image.url;
        link.download = `gemini-studio-${image.id}.jpg`;
        link.click();
    };

    return (
        <div onClick={() => onClick && onClick(image)} className="group relative glass rounded-[2rem] overflow-hidden flex flex-col glass-hover cursor-pointer border-white/10">
            <div className="relative aspect-square bg-slate-900/50 overflow-hidden flex items-center justify-center">
                <img
                    src={image.url}
                    alt={image.prompt}
                    className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110"
                />

                {/* Overlay de acciones */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-2 z-10">
                    <div className="flex w-full gap-2 justify-center">
                        <button
                            onClick={(e) => { e.stopPropagation(); onRegenerate(image); }}
                            className="flex-1 flex flex-col items-center gap-1 text-[9px] text-emerald-100"
                            title="Regenerar"
                        >
                            <div className="w-7 h-7 rounded-full bg-emerald-700/90 border border-emerald-400 flex items-center justify-center shadow">
                                <RefreshCw size={12} />
                            </div>
                            <span>Regenerar</span>
                        </button>

                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(image); }}
                            className="flex-1 flex flex-col items-center gap-1 text-[9px] text-sky-100"
                            title="Editar"
                        >
                            <div className="w-7 h-7 rounded-full bg-sky-700/90 border border-sky-400 flex items-center justify-center shadow">
                                <MessageSquare size={12} />
                            </div>
                            <span>Editar</span>
                        </button>

                        <button
                            onClick={handleDownload}
                            className="flex-1 flex flex-col items-center gap-1 text-[9px] text-slate-100"
                            title="Descargar"
                        >
                            <div className="w-7 h-7 rounded-full bg-slate-900/90 border border-slate-500 flex items-center justify-center shadow">
                                <Download size={12} />
                            </div>
                            <span>Descargar</span>
                        </button>

                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(image.id); }}
                            className="flex-1 flex flex-col items-center gap-1 text-[9px] text-red-100"
                            title="Eliminar"
                        >
                            <div className="w-7 h-7 rounded-full bg-red-700/90 border border-red-400 flex items-center justify-center shadow">
                                <Trash2 size={12} />
                            </div>
                            <span>Eliminar</span>
                        </button>
                    </div>
                </div>

                {/* Info Badge */}
                <div className="absolute top-4 left-4 z-0 opacity-100 group-hover:opacity-0 transition-opacity">
                    <div className="px-3 py-1 glass rounded-full text-[10px] font-bold uppercase tracking-widest text-white/90 border-cyan-400/30">
                        {image.style.name} | {image.aspectRatio}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Splash = ({ onSelect }) => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-12">
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-top-4">
            <h1 className="text-6xl md:text-8xl font-extrabold gradient-text tracking-tight uppercase">Edita como un Pro</h1>
            <p className="text-gray-300 text-lg md:text-2xl font-light max-w-2xl mx-auto">
                <span className="neon-text font-semibold">Generación/Edición Visual de Imágenes</span>
            </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
            <button onClick={() => onSelect('remix')} className="group glass glass-hover relative p-12 rounded-[3rem] text-left space-y-4 overflow-hidden border-purple-500/30">
                <div className="absolute top-0 right-0 p-8 text-purple-500/10 transform group-hover:scale-150 group-hover:rotate-12 transition-transform duration-700">
                    <ImageIcon size={200} />
                </div>
                <div className="bg-purple-500/20 w-16 h-16 rounded-2xl flex items-center justify-center text-purple-400 mb-6 border border-purple-500/30">
                    <Wand2 size={32} />
                </div>
                <h2 className="text-4xl font-bold">Editar Imagen</h2>
                <p className="text-gray-400 text-lg leading-relaxed">Edita imágenes existentes con la potencia de Nano Banana.</p>

            </button>
            <button onClick={() => onSelect('text-to-image')} className="group glass glass-hover relative p-12 rounded-[3rem] text-left space-y-4 overflow-hidden border-cyan-500/30">
                <div className="absolute top-0 right-0 p-8 text-cyan-500/10 transform group-hover:scale-150 group-hover:-rotate-12 transition-transform duration-700">
                    <Sparkles size={200} />
                </div>
                <div className="bg-cyan-500/20 w-16 h-16 rounded-2xl flex items-center justify-center text-cyan-400 mb-6 border border-cyan-500/30">
                    <Sparkles size={32} />
                </div>
                <h2 className="text-4xl font-bold">Generar Imágenes</h2>
                <p className="text-gray-400 text-lg leading-relaxed">Genera imágenes desde una descripción de texto.</p>

            </button>
        </div>
    </div>
);

// --- APP MAIN ---
const App = () => {
    const [view, setView] = useState('splash');
    const [mode, setMode] = useState('text-to-image');
    const [prompt, setPrompt] = useState('');
    const [enhancedPrompts, setEnhancedPrompts] = useState([]);
    const [selectedStyle, setSelectedStyle] = useState(STYLE_PRESETS[0]);
    const [customStyle, setCustomStyle] = useState('');
    const [selectedAR, setSelectedAR] = useState(AspectRatio.SQUARE);
    const [selectedSize, setSelectedSize] = useState(ImageSize.SIZE_1K);
    const [images, setImages] = useState([]);
    const [remixSource, setRemixSource] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [editImage, setEditImage] = useState(null);
    const [editInstruction, setEditInstruction] = useState('');
    const [error, setError] = useState(null);
    const [lightboxImage, setLightboxImage] = useState(null);

    const fileInputRef = useRef(null);
    const detectedARRef = useRef(null);

    const handleStart = (m) => {
        setMode(m);
        setView('editor');
        if (m === 'remix') setTimeout(() => fileInputRef.current?.click(), 100);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result;
                setRemixSource(dataUrl);

                // Detectar AR de la imagen subida
                const img = new Image();
                img.onload = () => {
                    const ratio = img.width / img.height;
                    let detectedAR = AspectRatio.SQUARE;

                    if (Math.abs(ratio - 1) < 0.1) detectedAR = AspectRatio.SQUARE; // 1:1
                    else if (Math.abs(ratio - 0.75) < 0.1) detectedAR = AspectRatio.PORTRAIT; // 3:4
                    else if (Math.abs(ratio - 1.77) < 0.15) detectedAR = AspectRatio.WIDE; // 16:9
                    else if (Math.abs(ratio - 0.56) < 0.1) detectedAR = AspectRatio.TALL; // 9:16
                    else if (Math.abs(ratio - 2.33) < 0.2) detectedAR = AspectRatio.ULTRAWIDE; // 21:9
                    else if (ratio > 1.5) detectedAR = AspectRatio.WIDE;
                    else if (ratio < 0.8) detectedAR = AspectRatio.PORTRAIT;

                    detectedARRef.current = detectedAR;
                    setSelectedAR(detectedAR);
                };
                img.src = dataUrl;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEnhance = async () => {
        if (!prompt.trim()) return;
        setIsEnhancing(true);
        try {
            const enhanced = await enhancePrompt(prompt);
            setEnhancedPrompts(enhanced);
        } catch (err) { console.error(err); } finally { setIsEnhancing(false); }
    };

    const handleGenerate = async (finalPrompt = prompt) => {
        const effectivePrompt = finalPrompt.trim() || (mode === 'remix' && remixSource ? ' ' : '');
        if (!effectivePrompt && !(mode === 'remix' && remixSource)) return;
        setIsGenerating(true);
        setError(null);
        try {
            const styleSuffix = selectedStyle.id === 'custom' ? customStyle : selectedStyle.promptSuffix;
            const imageUrl = await generateImage({
                prompt: effectivePrompt,
                styleSuffix,
                aspectRatio: selectedAR,
                size: selectedSize,
                sourceImage: remixSource || undefined
            });
            const newImage = {
                id: Math.random().toString(36).substring(7),
                url: imageUrl,
                prompt: effectivePrompt || 'Remezcla',
                style: selectedStyle,
                aspectRatio: selectedAR,
                size: selectedSize,
                createdAt: Date.now()
            };
            setImages([newImage, ...images]);

            // Restaurar el AR de la imagen original si existe
            if (detectedARRef.current) {
                setSelectedAR(detectedARRef.current);
            }
        } catch (err) {
            setError(err.message || "Error de generación");
        } finally { setIsGenerating(false); }
    };

    const handleDelete = (id) => setImages(images.filter(img => img.id !== id));
    const handleRegenerate = (img) => {
        setPrompt(img.prompt);
        setSelectedStyle(img.style);
        setSelectedAR(img.aspectRatio);
        handleGenerate(img.prompt);
    };
    const handleOpenEdit = (img) => {
        setEditImage(img);
        setEditInstruction('');
    };

    const handleEditSubmit = async () => {
        if (!editImage || !editInstruction.trim()) return;
        setIsGenerating(true);
        try {
            const updatedUrl = await editImageConversation({
                originalImage: editImage.url,
                instruction: editInstruction,
                aspectRatio: editImage.aspectRatio
            });
            const updatedImage = { ...editImage, id: Math.random().toString(36).substring(7), url: updatedUrl, createdAt: Date.now() };
            setImages([updatedImage, ...images]);
            setEditImage(null);
        } catch (err) { setError("Error de edición"); } finally { setIsGenerating(false); }
    };

    const isGenerateDisabled = isGenerating || (mode === 'text-to-image' && !prompt.trim()) || (mode === 'remix' && !remixSource);

    return (
        <ApiKeyChecker>
            <div className="min-h-screen custom-scrollbar overflow-y-auto">
                {view === 'splash' ? (
                    <Splash onSelect={handleStart} />
                ) : (
                    <div className="flex flex-col lg:flex-row min-h-screen">
                        <aside className="lg:w-[440px] glass border-r border-white/5 lg:sticky lg:top-0 lg:h-screen overflow-y-auto p-10 space-y-10 custom-scrollbar flex flex-col z-20">
                            <div className="flex items-center justify-between shrink-0">
                                <button onClick={() => setView('splash')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-all text-[11px] font-bold uppercase tracking-widest">
                                    <ChevronLeft size={16} /> <span>Volver</span>
                                </button>

                            </div>

                            {mode === 'remix' && (
                                <div className="space-y-4 animate-in">
                                    <label className="text-[11px] font-bold text-purple-400 uppercase tracking-widest">Imagen a Editar</label>
                                    <div onClick={() => fileInputRef.current?.click()} className="relative group cursor-pointer border-2 border-dashed border-purple-500/30 rounded-[2.5rem] overflow-hidden aspect-video flex items-center justify-center bg-slate-900/40 hover:border-purple-500 transition-all">
                                        {remixSource ? <img src={remixSource} className="w-full h-full object-contain" /> : <div className="text-purple-400 flex flex-col items-center gap-2"><Upload size={24} /><span className="text-[10px] font-bold uppercase">Sube Imagen</span></div>}
                                    </div>
                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                                </div>
                            )}

                            <div className="space-y-4">
                                <label className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">Quieres añadir algo??</label>
                                <div className="relative">
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="Detalla lo que deseas ver en tu imagen..."
                                        className="w-full h-48 bg-black/20 border border-white/5 rounded-3xl p-6 text-sm outline-none resize-none custom-scrollbar focus:border-cyan-400 transition-all shadow-inner"
                                    />
                                    <button
                                        onClick={handleEnhance}
                                        disabled={isEnhancing || !prompt.trim()}
                                        className="absolute bottom-4 right-4 p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl hover:bg-cyan-500/30 transition-all z-30"
                                    >
                                        {isEnhancing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">Estilos Predeterminados</label>
                                <div className="grid grid-cols-1 gap-4">
                                    <CustomSelect
                                        options={STYLE_PRESETS}
                                        value={selectedStyle.id}
                                        onChange={(id) => setSelectedStyle(STYLE_PRESETS.find(s => s.id === id))}
                                    />
                                    {selectedStyle.id === 'custom' && (
                                        <input type="text" value={customStyle} onChange={(e) => setCustomStyle(e.target.value)} placeholder="Ej: estilo barroco, realista..." className="w-full bg-black/20 border border-white/5 rounded-3xl p-4 text-xs outline-none focus:border-cyan-400 transition-all" />
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">Formato de Salida</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {ASPECT_RATIOS.map((ar) => (
                                        <button
                                            key={ar.id}
                                            onClick={() => setSelectedAR(ar.id)}
                                            className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${selectedAR === ar.id ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]' : 'border-white/5 bg-white/5 text-gray-600 hover:border-white/10'}`}
                                        >
                                            <div className="flex items-center justify-center">{ar.icon}</div>
                                            <span className="text-[9px] font-bold tracking-tighter">{ar.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {enhancedPrompts.length > 0 && (
                                <div className="space-y-3 animate-in">
                                    <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Optimización de Prompt</div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {enhancedPrompts.map((p, idx) => (
                                            <button key={idx} onClick={() => setPrompt(p.text)} className="p-4 text-left text-[11px] bg-white/5 border border-white/5 rounded-2xl hover:bg-cyan-500/10 hover:border-cyan-500/20 transition-all group">
                                                <span className="block font-bold text-cyan-400 mb-1 tracking-widest uppercase text-[9px]">{p.type}</span>
                                                <span className="text-gray-400 line-clamp-2 group-hover:text-gray-300">{p.text}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-6 order-last">
                                <button onClick={() => handleGenerate()} disabled={isGenerateDisabled} className="w-full py-5 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-bold rounded-[2rem] flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-[0_0_20px_rgba(46,232,255,0.3)] btn-3d disabled:opacity-20">
                                    {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                                    {isGenerating ? 'PROCESANDO...' : 'GENERAR EDICIÓN'}
                                </button>
                                {error && <p className="text-red-400 text-[10px] text-center mt-4 font-bold uppercase tracking-widest">{error}</p>}
                            </div>
                        </aside>

                        <main className="flex-1 p-10 lg:p-20 overflow-y-auto custom-scrollbar">
                            <div className="max-w-7xl mx-auto space-y-16">
                                <div className="flex items-end justify-between">
                                    <div className="space-y-2">
                                        <h2 className="text-4xl font-bold tracking-tight">Historial de Imágenes Editadas</h2>
                                        <p className="text-gray-400 font-medium">Controla y refina tus creaciones visuales en tiempo real.</p>
                                    </div>

                                </div>

                                {images.length === 0 ? (
                                    <div className="h-[50vh] flex flex-col items-center justify-center text-center space-y-6 animate-in">
                                        <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center text-gray-700 border border-white/5 shadow-inner">
                                            <ImageIcon size={48} />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-xl font-bold text-gray-400 tracking-tight"></h3>
                                            <p className="text-gray-600 max-w-sm mx-auto"></p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
                                        {images.map((img) => (
                                            <ImageCard key={img.id} image={img} onDelete={handleDelete} onRegenerate={handleRegenerate} onEdit={handleOpenEdit} onClick={setLightboxImage} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </main>

                        {lightboxImage && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-8" onClick={() => setLightboxImage(null)}>
                                <div className="relative max-w-6xl w-full h-full flex flex-col items-center justify-center gap-8">
                                    <img src={lightboxImage.url} className="max-w-full max-h-[85vh] object-contain rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/5" onClick={(e) => e.stopPropagation()} />
                                    <div className="glass px-8 py-4 rounded-full flex gap-10 text-[11px] font-bold text-gray-400 tracking-widest uppercase" onClick={(e) => e.stopPropagation()}>
                                        <span className="text-cyan-400">{lightboxImage.aspectRatio}</span>
                                        <span>RES: {lightboxImage.size}</span>
                                        <span className="text-gray-600">ID: {lightboxImage.id}</span>
                                    </div>
                                    <button onClick={() => setLightboxImage(null)} className="absolute top-0 right-0 p-6 text-gray-600 hover:text-white transition-all"><X size={32} /></button>
                                </div>
                            </div>
                        )}

                        {editImage && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-950/80 backdrop-blur-md animate-in">
                                <div className="glass max-w-4xl w-full rounded-[3.5rem] overflow-hidden flex flex-col shadow-2xl border border-white/10">
                                    <div className="p-10 border-b border-white/5 flex items-center justify-between">
                                        <h3 className="text-2xl font-bold flex items-center gap-4">
                                            <Wand2 size={24} className="text-purple-400" /> Refinar Proyecto
                                        </h3>
                                        <button onClick={() => setEditImage(null)} className="p-2 text-gray-500 hover:text-white transition-all"><X size={24} /></button>
                                    </div>
                                    <div className="p-12 flex flex-col md:flex-row gap-12">
                                        <div className="w-full md:w-1/2 aspect-square rounded-[2.5rem] overflow-hidden bg-slate-900 border border-white/5 shadow-inner">
                                            <img src={editImage.url} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 flex flex-col justify-between space-y-8">
                                            <div className="space-y-4">
                                                <div className="bg-cyan-500/10 p-5 rounded-2xl text-[11px] text-cyan-300 leading-relaxed border border-cyan-500/20 font-medium">
                                                    Indica modificaciones puntuales (luz, color, expansión) para aplicar sobre la base actual manteniendo la coherencia estructural.
                                                </div>
                                                <textarea
                                                    value={editInstruction}
                                                    onChange={(e) => setEditInstruction(e.target.value)}
                                                    placeholder="Ej: 'Transforma la iluminación a un atardecer cálido'..."
                                                    className="w-full h-44 bg-black/20 border border-white/5 rounded-3xl p-6 text-sm outline-none resize-none focus:border-cyan-400 transition-all shadow-inner"
                                                />
                                            </div>
                                            <button onClick={handleEditSubmit} disabled={isGenerating || !editInstruction.trim()} className="w-full py-5 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-bold rounded-[2rem] flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-[0_0_20px_rgba(46,232,255,0.3)] btn-3d disabled:opacity-20">
                                                {isGenerating ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                                                Aplicar Cambios
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </ApiKeyChecker>
    );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
