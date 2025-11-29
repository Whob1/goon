
import { LLMProvider, TTSProvider, STTProvider } from './providers';

interface VoiceCallConfig {
  vadSensitivity: number;
  turnDetectionThreshold: number;
  handsFreeMode: boolean;
  llmProvider: LLMProvider;
  ttsProvider: TTSProvider;
  sttProvider: STTProvider;
}

export class VoiceCallManager {
  private config: VoiceCallConfig;
  private isActive: boolean = false;

  constructor() {
    this.config = {
      vadSensitivity: 0.5,
      turnDetectionThreshold: 200,
      handsFreeMode: false,
      llmProvider: new LLMProvider('mistral'),
      ttsProvider: new TTSProvider('elevenlabs'),
      sttProvider: new STTProvider('deepgram')
    };
  }

  configure(config: Partial<VoiceCallConfig>): void {
    this.config = { ...this.config, ...config };
  }

  startCall(): void {
    this.isActive = true;
    console.log('Voice call started with configuration:', this.config);
    // Implementation for starting voice call
  }

  endCall(): void {
    this.isActive = false;
    console.log('Voice call ended');
    // Implementation for ending voice call
  }

  getStatus(): { isActive: boolean; config: VoiceCallConfig } {
    return {
      isActive: this.isActive,
      config: this.config
    };
  }
}
