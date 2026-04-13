/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: AudioWorkletNode | null = null;
  private workletUrl: string | null = null;
  private onAudioData: (data: string) => void;
  private isRecording = false;

  // Playback properties
  private playbackContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sampleRate = 24000; // Gemini output rate

  constructor(onAudioData: (data: string) => void) {
    this.onAudioData = onAudioData;
  }

  async start() {
    if (this.isRecording) return;

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.playbackContext = new AudioContext({ sampleRate: 24000 });
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.audioContext.createMediaStreamSource(this.stream);

    // We'll use a simple ScriptProcessorNode for now as AudioWorklet requires a separate file
    // and ScriptProcessorNode is easier to bundle in this environment.
    // However, the instructions say "Implement manual PCM encoding/decoding".
    
    const bufferSize = 4096;
    const scriptNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
    
    scriptNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = this.float32ToPcm16(inputData);
      const base64Data = this.arrayBufferToBase64(pcmData.buffer);
      this.onAudioData(base64Data);
    };

    this.source.connect(scriptNode);
    scriptNode.connect(this.audioContext.destination);
    
    this.isRecording = true;
    this.nextStartTime = this.playbackContext.currentTime;
  }

  stop() {
    this.isRecording = false;
    this.stream?.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
    this.playbackContext?.close();
    this.audioContext = null;
    this.playbackContext = null;
    this.stream = null;
    this.source = null;
  }

  clearPlaybackQueue() {
    if (this.playbackContext) {
      // Closing and reopening the context is the most reliable way to stop all scheduled buffers
      // in a simple implementation without tracking every source node.
      this.playbackContext.close();
      this.playbackContext = new AudioContext({ sampleRate: 24000 });
      this.nextStartTime = this.playbackContext.currentTime;
    }
  }

  // Play PCM16 data
  async playAudioChunk(base64Data: string) {
    if (!this.playbackContext) return;

    const arrayBuffer = this.base64ToArrayBuffer(base64Data);
    const pcm16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(pcm16.length);

    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }

    const audioBuffer = this.playbackContext.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = this.playbackContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.playbackContext.destination);

    const startTime = Math.max(this.nextStartTime, this.playbackContext.currentTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;
  }

  private float32ToPcm16(float32Array: Float32Array): Int16Array {
    const pcm16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm16Array;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
