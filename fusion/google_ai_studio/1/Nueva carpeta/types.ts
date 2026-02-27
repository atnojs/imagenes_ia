
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion';

export interface ImageSettings {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  isGrayscale: boolean;
  opacity: number; // 0 to 1
}

export interface ImageSource {
  id: string;
  url: string;
  name: string;
  settings: ImageSettings;
}

export interface HistoryItem {
  id: string;
  url: string;
  timestamp: number;
  type: 'local' | 'ai';
  config: {
    blendMode: BlendMode;
    opacity1: number;
    opacity2: number;
    image1: ImageSource;
    image2: ImageSource;
  };
}

export interface SessionData {
  image1: ImageSource | null;
  image2: ImageSource | null;
  blendMode: BlendMode;
  history: HistoryItem[];
}
