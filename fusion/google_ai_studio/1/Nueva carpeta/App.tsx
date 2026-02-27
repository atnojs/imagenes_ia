
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, RefreshCw, Layers, Sliders, Image as ImageIcon, 
  Trash2, Download, Save, FolderOpen, Wand2, Sun, Moon, 
  Move, RotateCcw, Maximize, Scissors, Play, CheckCircle2,
  Clock, History
} from 'lucide-react';
import { BlendMode, ImageSettings, ImageSource, HistoryItem, SessionData } from './types';

// Default settings for images
const DEFAULT_SETTINGS: ImageSettings = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  isGrayscale: false,
  opacity: 1,
};

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiplicar' },
  { value: 'screen', label: 'Trama' },
  { value: 'overlay', label: 'Superponer' },
  { value: 'darken', label: 'Oscurecer' },
  { value: 'lighten', label: 'Aclarar' },
  { value: 'color-dodge', label: 'Esquivar color' },
  { value: 'color-burn', label: 'Quemado lineal' },
  { value: 'hard-light', label: 'Luz fuerte' },
  { value: 'soft-light', label: 'Luz suave' },
  { value: 'difference', label: 'Diferencia' },
  { value: 'exclusion', label: 'Exclusión' },
];

const App: React.FC = () => {
  // State
  const [image1, setImage1] = useState<ImageSource | null>(null);
  const [image2, setImage2] = useState<ImageSource | null>(null);
  const [blendMode, setBlendMode] = useState<BlendMode>('normal');
  const [crossfade, setCrossfade] = useState<number>(50); // 0 (Img1) to 100 (Img2)
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'edit' | 'history'>('edit');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync image opacities with crossfade
  useEffect(() => {
    if (image1) {
      const opacity1 = (100 - crossfade) / 100;
      setImage1(prev => prev ? { ...prev, settings: { ...prev.settings, opacity: opacity1 } } : null);
    }
    if (image2) {
      const opacity2 = crossfade / 100;
      setImage2(prev => prev ? { ...prev, settings: { ...prev.settings, opacity: opacity2 } } : null);
    }
  }, [crossfade]);

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        const newImg: ImageSource = {
          id: Math.random().toString(36).substr(2, 9),
          url,
          name: file.name,
          settings: { ...DEFAULT_SETTINGS, opacity: slot === 1 ? (100 - crossfade) / 100 : crossfade / 100 }
        };
        if (slot === 1) setImage1(newImg);
        else setImage2(newImg);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, slot: 1 | 2) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        const newImg: ImageSource = {
          id: Math.random().toString(36).substr(2, 9),
          url,
          name: file.name,
          settings: { ...DEFAULT_SETTINGS, opacity: slot === 1 ? (100 - crossfade) / 100 : crossfade / 100 }
        };
        if (slot === 1) setImage1(newImg);
        else setImage2(newImg);
      };
      reader.readAsDataURL(file);
    }
  };

  const swapLayers = () => {
    const temp = image1;
    setImage1(image2);
    setImage2(temp);
  };

  const resetSettings = (slot: 1 | 2) => {
    if (slot === 1 && image1) setImage1({ ...image1, settings: { ...DEFAULT_SETTINGS, opacity: image1.settings.opacity } });
    if (slot === 2 && image2) setImage2({ ...image2, settings: { ...DEFAULT_SETTINGS, opacity: image2.settings.opacity } });
  };

  const updateSetting = (slot: 1 | 2, key: keyof ImageSettings, value: any) => {
    if (slot === 1 && image1) setImage1({ ...image1, settings: { ...image1.settings, [key]: value } });
    if (slot === 2 && image2) setImage2({ ...image2, settings: { ...image2.settings, [key]: value } });
  };

  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !image1 || !image2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match the larger image for max quality
    const img1 = await loadImage(image1.url);
    const img2 = await loadImage(image2.url);
    
    canvas.width = Math.max(img1.width, img2.width);
    canvas.height = Math.max(img1.height, img2.height);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw first image
    drawLayer(ctx, img1, image1.settings, canvas.width, canvas.height);
    
    // Set blend mode and draw second image
    ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
    drawLayer(ctx, img2, image2.settings, canvas.width, canvas.height);
    
    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
    
    setPreviewUrl(canvas.toDataURL('image/png'));
  }, [image1, image2, blendMode]);

  useEffect(() => {
    if (image1 && image2) {
      renderCanvas();
    }
  }, [image1, image2, blendMode, renderCanvas]);

  const drawLayer = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, settings: ImageSettings, cw: number, ch: number) => {
    ctx.save();
    
    // Opacity
    ctx.globalAlpha = settings.opacity;
    
    // Position/Transform
    const centerX = cw / 2 + settings.x;
    const centerY = ch / 2 + settings.y;
    ctx.translate(centerX, centerY);
    ctx.rotate((settings.rotation * Math.PI) / 180);
    ctx.scale(settings.scale, settings.scale);

    // Filter
    if (settings.isGrayscale) {
      ctx.filter = 'grayscale(100%)';
    } else {
      ctx.filter = 'none';
    }

    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  };

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  const handleFusionAI = async () => {
    if (!image1 || !image2) return;
    setIsProcessing(true);

    try {
      // Mock prompt generation logic
      const prompt = `Fusión artística avanzada de dos imágenes. Estilo cinematográfico, transiciones suaves, combinando ${image1.name} y ${image2.name} con un enfoque equilibrado.`;

      // Structure data for Gemini Proxy
      const payload = {
        model: 'gemini-3-pro-image-preview',
        prompt: prompt,
        contents: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: image1.url.split(',')[1]
            }
          },
          {
            inlineData: {
              mimeType: 'image/png',
              data: image2.url.split(',')[1]
            }
          }
        ]
      };

      const response = await fetch('proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      // Assume result.image is the base64 output
      if (result.image) {
        const historyItem: HistoryItem = {
          id: Math.random().toString(36).substr(2, 9),
          url: `data:image/png;base64,${result.image}`,
          timestamp: Date.now(),
          type: 'ai',
          config: {
            blendMode,
            opacity1: image1.settings.opacity,
            opacity2: image2.settings.opacity,
            image1: JSON.parse(JSON.stringify(image1)),
            image2: JSON.parse(JSON.stringify(image2))
          }
        };
        setHistory(prev => [historyItem, ...prev]);
        setPreviewUrl(historyItem.url);
      }
    } catch (error) {
      console.error("AI Fusion error:", error);
      alert("Error al procesar con IA. Asegúrate de que proxy.php esté configurado correctamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const saveToHistory = () => {
    if (!previewUrl || !image1 || !image2) return;
    const historyItem: HistoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      url: previewUrl,
      timestamp: Date.now(),
      type: 'local',
      config: {
        blendMode,
        opacity1: image1.settings.opacity,
        opacity2: image2.settings.opacity,
        image1: JSON.parse(JSON.stringify(image1)),
        image2: JSON.parse(JSON.stringify(image2))
      }
    };
    setHistory(prev => [historyItem, ...prev]);
  };

  const loadFromHistory = (item: HistoryItem) => {
    setImage1(item.config.image1);
    setImage2(item.config.image2);
    setBlendMode(item.config.blendMode);
    setCrossfade(item.config.opacity2 * 100);
    setActiveTab('edit');
  };

  const exportImage = (quality: 'low' | 'med' | 'high') => {
    if (!previewUrl) return;
    const link = document.createElement('a');
    link.download = `fusion-studio-${quality}-${Date.now()}.png`;
    link.href = previewUrl; // For higher quality we could re-render canvas at different scales
    link.click();
  };

  const saveSession = () => {
    const session: SessionData = {
      image1,
      image2,
      blendMode,
      history
    };
    const blob = new Blob([JSON.stringify(session)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `session-${Date.now()}.json`;
    link.click();
  };

  const loadSession = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as SessionData;
          setImage1(data.image1);
          setImage2(data.image2);
          setBlendMode(data.blendMode);
          setHistory(data.history || []);
        } catch (err) {
          alert("Archivo de sesión inválido.");
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] overflow-hidden">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 glass border-b border-white/10 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-500 rounded-lg shadow-lg shadow-sky-500/20">
            <Layers className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">FusionAI <span className="text-sky-400">Studio</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/10 text-sm">
            <FolderOpen className="w-4 h-4 text-sky-400" />
            Cargar Sesión
            <input type="file" className="hidden" accept=".json" onChange={loadSession} />
          </label>
          <button onClick={saveSession} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 text-sm">
            <Save className="w-4 h-4 text-sky-400" />
            Guardar Sesión
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Control Panel */}
        <aside className="w-80 glass border-r border-white/10 flex flex-col overflow-y-auto no-scrollbar">
          <div className="p-6 flex flex-col gap-8">
            
            {/* Tabs Toggle */}
            <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
              <button 
                onClick={() => setActiveTab('edit')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'edit' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                <Sliders className="w-4 h-4" /> Edición
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                <Clock className="w-4 h-4" /> Historial
              </button>
            </div>

            {activeTab === 'edit' ? (
              <div className="flex flex-col gap-8 animate-in fade-in duration-500">
                {/* Upload Section */}
                <div className="grid grid-cols-2 gap-3">
                  <div 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 1)}
                    className={`relative group h-32 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 overflow-hidden ${image1 ? 'border-sky-500/50 bg-sky-500/5' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                  >
                    {image1 ? (
                      <>
                        <img src={image1.url} className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-10 transition-opacity" />
                        <span className="relative text-xs font-medium text-sky-400 truncate px-2">{image1.name}</span>
                        <button onClick={() => setImage1(null)} className="absolute top-2 right-2 p-1 rounded-md bg-black/40 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-slate-500" />
                        <span className="text-[10px] text-slate-500 font-medium">CAPA 1</span>
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => handleImageUpload(e, 1)} />
                      </>
                    )}
                  </div>

                  <div 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 2)}
                    className={`relative group h-32 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 overflow-hidden ${image2 ? 'border-sky-500/50 bg-sky-500/5' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                  >
                    {image2 ? (
                      <>
                        <img src={image2.url} className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-10 transition-opacity" />
                        <span className="relative text-xs font-medium text-sky-400 truncate px-2">{image2.name}</span>
                        <button onClick={() => setImage2(null)} className="absolute top-2 right-2 p-1 rounded-md bg-black/40 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-slate-500" />
                        <span className="text-[10px] text-slate-500 font-medium">CAPA 2</span>
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => handleImageUpload(e, 2)} />
                      </>
                    )}
                  </div>
                </div>

                <button 
                  onClick={swapLayers}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Intercambiar Capas
                </button>

                {/* Blending & Opacity */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span>Modo de Fusión</span>
                    <ImageIcon className="w-3 h-3" />
                  </div>
                  <select 
                    value={blendMode}
                    onChange={(e) => setBlendMode(e.target.value as BlendMode)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-sky-500 transition-colors appearance-none"
                  >
                    {BLEND_MODES.map(mode => (
                      <option key={mode.value} value={mode.value} className="bg-slate-900">{mode.label}</option>
                    ))}
                  </select>
                </div>

                {/* Crossfade Slider */}
                <div className="flex flex-col gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex justify-between text-xs font-medium text-slate-400 mb-2">
                    <span className={crossfade < 50 ? 'text-sky-400' : ''}>Capa 1 ({100 - crossfade}%)</span>
                    <span className={crossfade > 50 ? 'text-sky-400' : ''}>Capa 2 ({crossfade}%)</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={crossfade} 
                    onChange={(e) => setCrossfade(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between gap-2 mt-2">
                    {[25, 50, 75].map(val => (
                      <button 
                        key={val}
                        onClick={() => setCrossfade(val)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${crossfade === val ? 'bg-sky-500/20 border-sky-500 text-sky-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                      >
                        {100-val}/{val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Layer Adjustments */}
                <div className="flex flex-col gap-6">
                  {[1, 2].map((slot) => {
                    const img = slot === 1 ? image1 : image2;
                    if (!img) return null;
                    return (
                      <div key={slot} className="flex flex-col gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">Ajustes Capa {slot}</span>
                          <button onClick={() => resetSettings(slot as 1 | 2)} className="text-[10px] text-slate-500 hover:text-white flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" /> Reset
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] text-slate-500">Escala</label>
                            <input 
                              type="range" min="0.1" max="3" step="0.1" 
                              value={img.settings.scale}
                              onChange={(e) => updateSetting(slot as 1 | 2, 'scale', parseFloat(e.target.value))}
                              className="w-full"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] text-slate-500">Rotación</label>
                            <input 
                              type="range" min="-180" max="180" 
                              value={img.settings.rotation}
                              onChange={(e) => updateSetting(slot as 1 | 2, 'rotation', parseInt(e.target.value))}
                              className="w-full"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => updateSetting(slot as 1 | 2, 'isGrayscale', !img.settings.isGrayscale)}
                            className={`flex-1 py-2 px-3 rounded-xl border text-[10px] font-medium flex items-center justify-center gap-2 transition-all ${img.settings.isGrayscale ? 'bg-white/20 border-white text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                          >
                            <Sun className="w-3 h-3" /> Blanco y Negro
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 animate-in slide-in-from-right-10 duration-500">
                {history.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-4 opacity-50">
                    <History className="w-12 h-12" />
                    <p className="text-sm font-medium">No hay historial aún</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => loadFromHistory(item)}
                      className="group relative h-40 rounded-2xl overflow-hidden border border-white/10 cursor-pointer hover:border-sky-500 transition-all shadow-xl"
                    >
                      <img src={item.url} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-white bg-sky-500 px-2 py-0.5 rounded-full uppercase tracking-widest">{item.type}</span>
                          <span className="text-[10px] text-white/70">{new Date(item.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[10px] text-white/60 mt-1">Transparencia: {Math.round(item.config.opacity1 * 100)}/{Math.round(item.config.opacity2 * 100)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content: Canvas & Preview */}
        <div className="flex-1 relative flex flex-col bg-slate-900/50">
          <div className="flex-1 flex items-center justify-center p-12 overflow-hidden">
            <div className="relative group max-w-full max-h-full aspect-video flex items-center justify-center rounded-3xl overflow-hidden shadow-2xl border border-white/5 bg-slate-800">
              {!image1 && !image2 ? (
                <div className="flex flex-col items-center gap-4 text-slate-600 animate-pulse">
                  <ImageIcon className="w-20 h-20" />
                  <p className="text-lg font-medium">Sube dos imágenes para comenzar</p>
                </div>
              ) : isProcessing ? (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
                  <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_30px_rgba(56,189,248,0.5)]"></div>
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xl font-bold text-white">Fusionando con Gemini AI</p>
                    <p className="text-sky-400 text-sm animate-pulse">Analizando composiciones artísticas...</p>
                  </div>
                </div>
              ) : null}

              <canvas ref={canvasRef} className="hidden" />
              
              {previewUrl && (
                <img 
                  src={previewUrl} 
                  className={`max-w-full max-h-full object-contain shadow-2xl transition-all duration-700 ${isProcessing ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`} 
                  alt="Fusion Preview"
                />
              )}
            </div>
          </div>

          {/* Bottom Bar: Actions */}
          <div className="h-24 glass-dark border-t border-white/5 flex items-center justify-between px-10 gap-6 z-40">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleFusionAI}
                disabled={!image1 || !image2 || isProcessing}
                className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl font-bold text-sm transition-all transform hover:scale-105 active:scale-95 ${!image1 || !image2 ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-xl shadow-sky-500/20 hover:shadow-sky-500/40'}`}
              >
                <Wand2 className="w-5 h-5" /> Fusión IA
              </button>
              <button 
                onClick={saveToHistory}
                disabled={!previewUrl}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm transition-all"
              >
                <CheckCircle2 className="w-5 h-5 text-sky-400" /> Guardar Local
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="group relative">
                <button className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-sm transition-all">
                  <Download className="w-5 h-5 text-sky-400" /> Exportar
                </button>
                <div className="absolute bottom-full mb-2 right-0 hidden group-hover:flex flex-col gap-1 p-2 bg-slate-800 border border-white/10 rounded-xl min-w-[140px] shadow-2xl">
                  <button onClick={() => exportImage('low')} className="text-left px-4 py-2 hover:bg-white/5 rounded-lg text-xs text-slate-300 transition-colors">Baja Resolución</button>
                  <button onClick={() => exportImage('med')} className="text-left px-4 py-2 hover:bg-white/5 rounded-lg text-xs text-slate-300 transition-colors border-y border-white/5">Media Resolución</button>
                  <button onClick={() => exportImage('high')} className="text-left px-4 py-2 hover:bg-white/5 rounded-lg text-xs text-slate-300 transition-colors">Alta Resolución</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Background Decor */}
      <div className="fixed -top-24 -left-24 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] -z-10 animate-pulse"></div>
      <div className="fixed -bottom-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -z-10 animate-pulse"></div>
    </div>
  );
};

export default App;
