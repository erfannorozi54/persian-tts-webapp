export interface TTSModel {
  id: string;
  name: string;
  description: string;
  huggingfaceId: string;
  vramRequired: number;
  languages: string[];
  capabilities: string[];
  localDir: string;
}

export interface SynthesizeRequest {
  text: string;
  modelId: string;
  refAudio?: string;
}

export interface SynthesizeResponse {
  audioBase64: string;
  format: string;
  duration?: number;
}

export interface ModelStatus {
  id: string;
  downloaded: boolean;
  ready: boolean;
  errorMessage?: string;
}

export interface CompareRequest {
  texts: { modelId: string; text: string }[];
}

export interface CompareResult {
  modelId: string;
  audioBase64: string;
  format: string;
  duration?: number;
  error?: string;
}
