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

const STYLE_GROUPS = {
    ilustracion: [
        { id: '', name: '🖌️ Dibujo / Ilustración', promptSuffix: '' },
        { id: 'anime', name: 'Anime Moderno', promptSuffix: 'Modern masterpiece anime style, high-quality animation aesthetic, sharp line art, vibrant cel-shading, expressive characters.' },
        { id: 'comic', name: 'Cómic Americano', promptSuffix: 'Classic American comic book style, Marvel/DC aesthetic, bold black ink outlines, heroic anatomy, vibrant colors, Ben-Day dots and halftone shading.' },
        { id: 'mortadelo', name: 'Mortadelo y Filemón', promptSuffix: 'Unmistakable Francisco Ibañez cartoon style, slapstick aesthetic, humorous caricatures. Include ONE or TWO small, clean speech bubbles with a very short, satirical and funny Spanish phrase strictly related to the main characters and their absurd situation. Keep text minimal and sharp.' },
        { id: 'boceto', name: 'Boceto a Lápiz', promptSuffix: 'Artistic charcoal and graphite pencil sketch, rough hand-drawn lines, visible hatching, textured paper background, expressive unfinished look.' },
        { id: 'ghibli', name: 'Studio Ghibli', promptSuffix: 'Breathtaking Studio Ghibli anime style, painterly hand-painted backgrounds, whimsical and nostalgic atmosphere, soft natural lighting, magical aesthetic.' },
        { id: 'manga-clasico', name: 'Manga Clásico (BN)', promptSuffix: 'Classic 90s monochrome manga style, hand-drawn ink lines, professional screentones, dramatic hatching, high-contrast black and white art.' },
        { id: 'line-art', name: 'Line Art Minimalista', promptSuffix: 'Clean minimalist line art, pure black lines on stark white background, sharp elegant contours, no shading, sophisticated simplicity.' },
        { id: 'cartoon-europeo', name: 'Cartoon Europeo', promptSuffix: 'Classic European bande dessinée style, Tintin/Spirou ligne claire aesthetic, flat charming colors, clean lines, nostalgic adventure atmosphere.' },
        { id: 'il-editorial', name: 'Ilustración Editorial', promptSuffix: 'Contemporary editorial illustration style, sophisticated color palette, stylized geometric shapes, conceptual visual storytelling, clean digital textures.' },
        { id: 'ink', name: 'Dibujo a Tinta', promptSuffix: 'Intricate black ink drawing, artistic cross-hatching, stippling techniques, fine detail, high-contrast pen and ink aesthetic.' }
    ],
    pictorico: [
        { id: '', name: '🎨 Arte / Tradicional', promptSuffix: '' },
        { id: 'acuarela', name: 'Acuarela Artística', promptSuffix: 'Exquisite watercolor painting, soft dreamlike color bleeds, realistic wet-on-wet technique, textured cold-press paper background, delicate artistic touch.' },
        { id: 'oleo', name: 'Pintura al Óleo', promptSuffix: 'Masterpiece oil painting on canvas, visible thick impasto brushstrokes, rich oil textures, dramatic chiaroscuro lighting, traditional fine art aesthetic.' },
        { id: 'vintage', name: 'Vintage / Retro', promptSuffix: 'Authentic retro vintage aesthetic, 1970s film grain, faded nostalgic colors, analog photography look, warm lighting, distressed texture.' },
        { id: 'fantasia', name: 'Fantasía Épica', promptSuffix: 'High fantasy concept art, magical glowing elements, legendary creatures, intricate gold armor, cinematic atmospheric lighting, epic scale.' },
        { id: 'surrealista', name: 'Surrealismo', promptSuffix: 'Surrealist masterpiece, dreamlike impossible landscape, melting objects, bizarre proportions, Dalí-esque subconscious imagery, thought-provoking.' },
        { id: 'gouache', name: 'Gouache Vibrante', promptSuffix: 'Vibrant gouache painting, flat opaque colors, hand-painted matte textures, charming book illustration aesthetic, bold and colorful.' },
        { id: 'acrilico', name: 'Acrílico Moderno', promptSuffix: 'Modern acrylic painting style, bold expressive colors, textured brushwork, high contrast, contemporary art gallery aesthetic.' },
        { id: 'expresionismo', name: 'Expresionismo', promptSuffix: 'Expressionist art style, intense emotional colors, distorted forms for dramatic impact, raw energetic brushstrokes, soul-stirring composition.' },
        { id: 'realismo', name: 'Realismo Pictórico', promptSuffix: 'Sophisticated painterly realism, focus on lighting and atmosphere, accurate proportions with visible artistic brushstrokes, high-end fine art.' },
        { id: 'impresionismo', name: 'Impresionismo', promptSuffix: 'Impressionist masterpiece, small thin visible brushstrokes, emphasis on light qualities, vibrant unmixed colors, capturing the fleeting movement.' }
    ],
    digital: [
        { id: '', name: '💻 Digital / 3D', promptSuffix: '' },
        { id: '3d-render', name: '3D Hyper-Render', promptSuffix: 'Professional 3D render, Octane rendering engine, 8k resolution, realistic ray-tracing, cinematic studio lighting, hyper-detailed textures.' },
        { id: 'lego', name: 'Estilo LEGO', promptSuffix: 'Constructed from high-quality LEGO bricks and minifigures, detailed plastic block textures, toy photography aesthetic, vibrant primary colors.' },
        { id: 'clay', name: 'Plastilina / Clay', promptSuffix: 'Handcrafted claymation style, tactile plasticine textures, fingerprints on material surface, stop-motion animation look, charming and organic.' },
        { id: 'pixel-art', name: 'Pixel Art Retro', promptSuffix: 'High-quality 16-bit pixel art, nostalgic retro video game aesthetic, vibrant limited color palette, clean grid-aligned pixels.' },
        { id: 'isometrico', name: '3D Isométrico', promptSuffix: 'Stylized 3D isometric perspective, clean geometry, miniature world aesthetic, soft global illumination, vibrant digital toy look.' },
        { id: 'low-poly', name: 'Low Poly Art', promptSuffix: 'Modern low poly 3D aesthetic, visible polygonal triangulation, clean gradients, minimalist geometric digital art.' },
        { id: 'clay-render', name: 'Clay Render 3D', promptSuffix: 'Professional 3D clay render, matte monochrome material, soft shadows, global illumination, focus on form and volume.' },
        { id: 'diorama', name: 'Diorama Digital', promptSuffix: 'Intricate digital diorama, miniature scene isolated in a 3D box, tilt-shift lens effect, magical and detailed miniature environment.' },
        { id: 'voxel', name: 'Voxel Art', promptSuffix: 'Detailed voxel art style, constructed from tiny 3D cubes, retro-modern digital aesthetic, vibrant 3D pixelated world.' },
        { id: 'maqueta', name: 'Maqueta 3D', promptSuffix: 'Architectural scale model style, clean white materials, precision laser-cut details, professional 3D presentation aesthetic.' }
    ],
    grafico: [
        { id: '', name: '📐 Gráfico / Moderno', promptSuffix: '' },
        { id: 'neon', name: 'Luces de Neón', promptSuffix: 'Vibrant neon light aesthetic, glowing electric colors, dark atmospheric background, synthwave cyberpunk vibe.' },
        { id: 'pop-art', name: 'Pop Art Clásico', promptSuffix: 'Iconic Pop Art style, Andy Warhol and Roy Lichtenstein aesthetic, bold solid colors, Ben-Day dots, high-impact graphic culture.' },
        { id: 'minimalista', name: 'Minimalismo Puro', promptSuffix: 'Minimalist graphic design, clean simple shapes, strategic use of negative space, restricted elegant color palette, essentialist aesthetic.' },
        { id: 'flat', name: 'Illustration Flat', promptSuffix: 'Modern flat design illustration, no shadows, geometric simplicity, clean solid colors, trendy digital graphic style.' },
        { id: 'vectorial', name: 'Gráfico Vectorial', promptSuffix: 'Sharp SVG vector illustration, smooth paths, clean edges, professional logo-style graphics, scalable digital art.' },
        { id: 'geometrico', name: 'Abstracción Geométrica', promptSuffix: 'Abstract art made of geometric patterns, triangles and circles, mathematical precision, vibrant color blocks, balanced composition.' },
        { id: 'memphis', name: 'Estilo Memphis', promptSuffix: 'Quirky 80s Memphis design movement, loud clashing patterns, zig-zags and squiggles, pastel colors with bold outlines.' },
        { id: 'duotono', name: 'Duotono Impactante', promptSuffix: 'Bold duotone color effect, two high-contrast ink colors, graphic design aesthetic, modern visual power.' },
        { id: 'glitch', name: 'Glitch Art Digital', promptSuffix: 'Digital glitch aesthetic, chromatic aberration, data corruption artifacts, scanlines, cybernetic distortion look.' },
        { id: 'poster', name: 'Póster Moderno', promptSuffix: 'Contemporary graphic poster layout, swiss design style, grid-based composition, high-impact typographic focus (simulated).' }
    ]
};

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
        const systemInstructions = `ERES UN EXPERTO EN MEJORA DE PROMPTS PARA GENERACIÓN DE IMÁGENES.
TU REGLA DE ORO ES: RESPETA ESTRICTAMENTE LA INTENCIÓN DEL USUARIO.
Instrucciones:
1. NO inventes sujetos nuevos (ej: si pide un perro, no digas que es un Golden Retriever a menos que él lo diga).
2. NO cambies el entorno drásticamente.
3. Céntrate en añadir detalles técnicos de calidad (iluminación, texturas, estilo de cámara) para que el prompt sea más efectivo pero manteniendo el mensaje original intacto.
4. Si el usuario pide un cambio pequeño (ej: "lazo rojo"), el prompt debe centrarse en ese cambio pero con mejor lenguaje técnico.

Analiza este prompt original: "${basePrompt}" y genera 4 variantes en español (Descriptiva, Cinematográfica, Artística, y Minimalista) siguiendo estas reglas estrictas.`;
        const contents = [{ parts: [{ text: systemInstructions }] }];
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
        const result = await callProxy('gemini-3.1-flash-image-preview', contents, config);
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text ? JSON.parse(text) : [];
    } catch (e) {
        console.error("Failed to enhance prompt", e);
        return [];
    }
};

const generateImage = async (params) => {
    let basePrompt = (params.prompt || '').trim();
    const styleSuffix = (params.styleSuffix || '').trim();
    const fullStylePrompt = `${basePrompt} ${styleSuffix}`.trim();

    let finalPrompt = '';
    if (params.sourceImage) {
        const sizeInfo = `Adjust the aspect ratio to ${params.aspectRatio}.`;
        if (fullStylePrompt) {
            finalPrompt = `${sizeInfo} TRANSFORM this entire image into the following style and content: ${fullStylePrompt}. Ensure the output is a complete, high-quality image that fills the ${params.aspectRatio} format perfectly.`;
        } else {
            finalPrompt = `${sizeInfo} Fill any empty areas seamlessly maintaining the original style and context of the image. The result must be a complete, natural image.`;
        }
    } else {
        finalPrompt = fullStylePrompt || 'A beautiful high-quality image';
    }

    const parts = [{ text: finalPrompt }];
    if (params.sourceImage) {
        const base64Data = params.sourceImage.split(',')[1];
        parts.push({ inlineData: { data: base64Data, mimeType: "image/png" } });
    }
    const contents = [{ parts }];
    const config = {
        generationConfig: {
            imageConfig: {
                aspectRatio: params.aspectRatio
            }
        }
    };
    const result = await callProxy('gemini-3.1-flash-image-preview', contents, config);
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
    const result = await callProxy('gemini-3.1-flash-image-preview', contents, config);
    const partsResponse = result?.candidates?.[0]?.content?.parts || [];
    for (const part of partsResponse) {
        if (part.inlineData) return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
    throw new Error("Error en la edición conversacional");
};

// --- COMPONENTS ---
const ApiKeyChecker = ({ children }) => <>{children}</>;

const LoadingOverlay = () => (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-500">
        <style>{`
            .spinner-triple { position: relative; width: 80px; height: 80px; }
            .spinner-triple .ring { position: absolute; border-radius: 50%; border: 3px solid transparent; }
            .spinner-triple .ring-1 { inset: 0; border-top-color: #22d3ee; animation: spin-loader 1.2s linear infinite; box-shadow: 0 0 20px rgba(34, 211, 238, 0.4); }
            .spinner-triple .ring-2 { inset: 10px; border-right-color: #a78bfa; animation: spin-loader-reverse 1s linear infinite; box-shadow: 0 0 15px rgba(167, 139, 250, 0.4); }
            .spinner-triple .ring-3 { inset: 20px; border-bottom-color: #f472b6; animation: spin-loader 0.8s linear infinite; box-shadow: 0 0 10px rgba(244, 114, 182, 0.4); }
            @keyframes spin-loader { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes spin-loader-reverse { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
            .loading-text-glow { color: white; font-size: 14px; font-weight: 600; text-transform: uppercase; tracking-widest: 0.2em; text-shadow: 0 0 10px rgba(34, 211, 238, 0.8); animation: pulse-text 2s ease-in-out infinite; }
            @keyframes pulse-text { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
        <div className="spinner-triple">
            <div className="ring ring-1"></div>
            <div className="ring ring-2"></div>
            <div className="ring ring-3"></div>
        </div>
        <div className="loading-text-glow">IA Generando Obra Maestra...</div>
    </div>
);

const CustomSelect = ({ options, value, onChange, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(opt => opt.id === value) || options[0];
    const isPlaceholder = !value;
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
                className={`w-full bg-black/20 border border-white/5 rounded-3xl p-4 text-[11px] outline-none cursor-pointer text-left flex items-center justify-between hover:border-cyan-400/50 focus:border-cyan-400 transition-all ${isPlaceholder ? 'opacity-60' : 'neon-border-purple'}`}
            >
                <span className={isPlaceholder ? 'text-gray-500' : 'text-gray-200'}>{selectedOption.name}</span>
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
        <div onClick={() => onClick && onClick(image)} className="group relative glass rounded-[2.5rem] overflow-hidden flex flex-col glass-hover cursor-zoom-in border-white/10 shadow-2xl">
            <div className="absolute top-4 left-4 z-10">
                <div className="px-3 py-1 glass rounded-full text-[9px] font-bold uppercase tracking-widest text-white/90 border-white/5 backdrop-blur-md">
                    {image.style.name} | {image.aspectRatio}
                </div>
            </div>
            <div className="relative aspect-square bg-slate-950 overflow-hidden flex items-center justify-center">
                <img
                    src={image.url}
                    alt={image.prompt}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                />

                <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-start justify-center pt-8 backdrop-blur-[2px] z-20">
                    <div className="flex items-center justify-center gap-4 w-full">
                        <button onClick={(e) => { e.stopPropagation(); onRegenerate(image); }} className="flex flex-col items-center gap-1.5 group/btn">
                            <div className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center group-hover/btn:bg-cyan-500/40 group-hover/btn:scale-110 transition-all shadow-lg">
                                <RefreshCw className="text-cyan-400" size={16} />
                            </div>
                            <span className="text-[8px] font-bold text-cyan-200 uppercase tracking-tighter">Nuevas</span>
                        </button>

                        <button onClick={(e) => { e.stopPropagation(); onEdit(image); }} className="flex flex-col items-center gap-1.5 group/btn">
                            <div className="w-9 h-9 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center group-hover/btn:bg-purple-500/40 group-hover/btn:scale-110 transition-all shadow-lg">
                                <MessageSquare className="text-purple-400" size={16} />
                            </div>
                            <span className="text-[8px] font-bold text-purple-200 uppercase tracking-tighter">Variar</span>
                        </button>

                        <button onClick={handleDownload} className="flex flex-col items-center gap-1.5 group/btn">
                            <div className="w-9 h-9 rounded-full bg-slate-800/80 border border-slate-600 flex items-center justify-center group-hover/btn:bg-slate-700 group-hover/btn:scale-110 transition-all shadow-lg">
                                <Download className="text-slate-200" size={16} />
                            </div>
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">Bajar</span>
                        </button>

                        <button onClick={(e) => { e.stopPropagation(); onDelete(image.id); }} className="flex flex-col items-center gap-1.5 group/btn">
                            <div className="w-9 h-9 rounded-full bg-red-900/40 border border-red-500/50 flex items-center justify-center group-hover/btn:bg-red-500/40 group-hover/btn:scale-110 transition-all shadow-lg">
                                <Trash2 className="text-red-400" size={16} />
                            </div>
                            <span className="text-[8px] font-bold text-red-300 uppercase tracking-tighter">Quitar</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-slate-900/80 backdrop-blur-md flex flex-col gap-1 border-t border-white/5">
                <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight italic">
                    {image.prompt}
                </p>
                <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mt-1">
                    {new Date(image.createdAt).toLocaleTimeString()}
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
    const [view, setView] = useState('editor');
    const [mode, setMode] = useState('text-to-image');
    const [prompt, setPrompt] = useState('');
    const [enhancedPrompts, setEnhancedPrompts] = useState([]);
    const [selectedStyle, setSelectedStyle] = useState(STYLE_GROUPS.ilustracion[0]);
    const [selectedAR, setSelectedAR] = useState(AspectRatio.SQUARE);
    const [images, setImages] = useState([]);
    const [remixSource, setRemixSource] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [editImage, setEditImage] = useState(null);
    const [editInstruction, setEditInstruction] = useState('');
    const [error, setError] = useState(null);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [originalImageAR, setOriginalImageAR] = useState(AspectRatio.SQUARE);

    const fileInputRef = useRef(null);

    const handleStart = (m) => {
        setMode(m);
        setView('editor');
        if (m === 'text-to-image') setRemixSource(null);
        if (m === 'remix') setTimeout(() => fileInputRef.current?.click(), 100);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (f) => {
            const img = new Image();
            img.onload = () => {
                const detectedAR = getClosestAspectRatio(img.width, img.height);
                setSelectedAR(detectedAR);
                setOriginalImageAR(detectedAR);
                setRemixSource(f.target.result);
            };
            img.src = f.target.result;
        };
        reader.readAsDataURL(file);
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
            const styleSuffix = selectedStyle.promptSuffix;
            const results = await Promise.all([
                generateImage({
                    prompt: effectivePrompt,
                    styleSuffix,
                    aspectRatio: selectedAR,
                    sourceImage: mode === 'remix' ? (remixSource || undefined) : undefined
                }),
                generateImage({
                    prompt: effectivePrompt + (mode === 'remix' ? " (Alternative detailed variation)" : " --variation distinct composition"),
                    styleSuffix,
                    aspectRatio: selectedAR,
                    sourceImage: mode === 'remix' ? (remixSource || undefined) : undefined
                })
            ]);

            const newHistoryImages = results.map(imageUrl => ({
                id: Math.random().toString(36).substring(7),
                url: imageUrl,
                prompt: effectivePrompt || 'Remezcla',
                style: selectedStyle,
                aspectRatio: selectedAR,
                size: '1K',
                createdAt: Date.now()
            }));

            setImages(prev => [...newHistoryImages, ...prev]);
        } catch (err) {
            setError(err.message || "Error de generación");
        } finally {
            setIsGenerating(false);
            // Resetear estados post-generación (mantenemos enhancedPrompts)
            setPrompt("");
            setSelectedStyle(STYLE_GROUPS.ilustracion[0]);
            setSelectedAR(AspectRatio.SQUARE);
        }
    };

    const handleDelete = (id) => setImages(images.filter(img => img.id !== id));
    const handleClearHistory = () => { if (window.confirm('¿Deseas eliminar todo el historial?')) setImages([]); };
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
            {isGenerating && <LoadingOverlay />}
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
                                        {remixSource ? <img src={remixSource} className="w-full h-full object-cover" /> : <div className="text-purple-400 flex flex-col items-center gap-2"><Upload size={24} /><span className="text-[10px] font-bold uppercase">Sube Imagen</span></div>}
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
                                        title="mejorar prompt con IA"
                                        className="absolute bottom-4 right-4 p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl hover:bg-cyan-500/30 transition-all z-30"
                                    >
                                        {isEnhancing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                                    </button>
                                </div>

                                {enhancedPrompts.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2 duration-300">
                                        {enhancedPrompts.map((p, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    setPrompt(p.text);
                                                }}
                                                className="text-[10px] text-left p-3 glass-light border border-white/5 rounded-2xl text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all leading-tight group"
                                            >
                                                <div className="font-bold text-[9px] uppercase tracking-tighter text-gray-500 group-hover:text-cyan-500 mb-1">{p.type}</div>
                                                <div className="line-clamp-2 italic opacity-80">{p.text}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-6">
                                <label className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">Panel de Estilos</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <CustomSelect
                                        options={STYLE_GROUPS.ilustracion}
                                        value={STYLE_GROUPS.ilustracion.some(s => s.id === selectedStyle.id) ? selectedStyle.id : ''}
                                        onChange={(id) => id ? setSelectedStyle(STYLE_GROUPS.ilustracion.find(s => s.id === id)) : setSelectedStyle({ id: '', name: 'Original', promptSuffix: '' })}
                                    />
                                    <CustomSelect
                                        options={STYLE_GROUPS.pictorico}
                                        value={STYLE_GROUPS.pictorico.some(s => s.id === selectedStyle.id) ? selectedStyle.id : ''}
                                        onChange={(id) => id ? setSelectedStyle(STYLE_GROUPS.pictorico.find(s => s.id === id)) : setSelectedStyle({ id: '', name: 'Original', promptSuffix: '' })}
                                    />
                                    <CustomSelect
                                        options={STYLE_GROUPS.digital}
                                        value={STYLE_GROUPS.digital.some(s => s.id === selectedStyle.id) ? selectedStyle.id : ''}
                                        onChange={(id) => id ? setSelectedStyle(STYLE_GROUPS.digital.find(s => s.id === id)) : setSelectedStyle({ id: '', name: 'Original', promptSuffix: '' })}
                                    />
                                    <CustomSelect
                                        options={STYLE_GROUPS.grafico}
                                        value={STYLE_GROUPS.grafico.some(s => s.id === selectedStyle.id) ? selectedStyle.id : ''}
                                        onChange={(id) => id ? setSelectedStyle(STYLE_GROUPS.grafico.find(s => s.id === id)) : setSelectedStyle({ id: '', name: 'Original', promptSuffix: '' })}
                                    />
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
                                    <button onClick={handleClearHistory} className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl transition-all text-[11px] font-bold uppercase tracking-widest border border-red-500/20">
                                        <Trash2 size={16} /> LIMPIAR TODO
                                    </button>
                                </div>

                                {images.length === 0 ? (
                                    <div className="h-[50vh] flex flex-col items-center justify-center text-center space-y-6 animate-in">
                                        <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center text-gray-700 border border-white/5 shadow-inner">
                                            <ImageIcon size={48} />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-xl font-bold text-gray-400 tracking-tight">No hay imágenes aún</h3>
                                            <p className="text-gray-600 max-w-sm mx-auto">Comienza por describir tu idea en el panel lateral.</p>
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
                            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-8 cursor-zoom-out" onClick={() => setLightboxImage(null)}>
                                <div className="relative max-w-6xl w-full h-full flex flex-col items-center justify-center gap-8">
                                    <img src={lightboxImage.url} className="max-w-full max-h-[85vh] object-contain rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/5" />
                                    <div className="glass px-8 py-4 rounded-full flex gap-10 text-[11px] font-bold text-gray-400 tracking-widest uppercase">
                                        <span className="text-cyan-400">{lightboxImage.aspectRatio}</span>
                                        <span>RES: {lightboxImage.size}</span>
                                        <span className="text-gray-600">ID: {lightboxImage.id}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {editImage && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-slate-950/80 backdrop-blur-md animate-in">
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
