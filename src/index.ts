// src/index.ts
import { VoiceCallManager } from './voiceCallManager';

export function hello(): string {
  return 'goon-voiceflow is running';
}

export function initializeVoiceCall(): VoiceCallManager {
  const callManager = new VoiceCallManager();
  callManager.configure({
    vadSensitivity: 0.7,
    turnDetectionThreshold: 300,
    handsFreeMode: true
  });
  return callManager;
}
