/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Power, Wifi, WifiOff, Volume2, Sparkles } from 'lucide-react';
import { AudioStreamer } from './lib/audio-streamer';
import { LiveSession } from './lib/live-session';

type SessionState = 'disconnected' | 'connecting' | 'listening' | 'speaking';

export default function App() {
  const [state, setState] = useState<SessionState>('disconnected');
  const [theme, setTheme] = useState<string>('futuristic');
  const [error, setError] = useState<string | null>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleAudioData = useCallback((base64: string) => {
    liveSessionRef.current?.sendAudio(base64);
  }, []);

  const handleModelAudio = useCallback((base64: string) => {
    audioStreamerRef.current?.playAudioChunk(base64);
  }, []);

  const handleInterrupted = useCallback(() => {
    // Stop current playback immediately when the user starts speaking
    audioStreamerRef.current?.clearPlaybackQueue();
    setState('listening');
  }, []);

  const toggleSession = async () => {
    if (state === 'disconnected') {
      try {
        setError(null);
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY is missing');
        }

        audioStreamerRef.current = new AudioStreamer(handleAudioData);
        liveSessionRef.current = new LiveSession(apiKey, {
          onAudioData: handleModelAudio,
          onInterrupted: handleInterrupted,
          onStateChange: setState,
          onThemeChange: setTheme,
          onError: (err) => {
            console.error('LiveSession Error:', err);
            setError(err.message || 'An error occurred');
            stopSession();
          },
        });

        await audioStreamerRef.current.start();
        await liveSessionRef.current.connect();
      } catch (err: any) {
        setError(err.message || 'Failed to start session');
        stopSession();
      }
    } else {
      stopSession();
    }
  };

  const stopSession = () => {
    audioStreamerRef.current?.stop();
    liveSessionRef.current?.disconnect();
    audioStreamerRef.current = null;
    liveSessionRef.current = null;
    setState('disconnected');
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-futuristic-bg relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-futuristic-accent opacity-10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-8 left-8 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-futuristic-accent/10 flex items-center justify-center border border-futuristic-accent/20">
          <Sparkles className="w-5 h-5 text-futuristic-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white/90">ZOYA <span className="text-futuristic-accent">AI</span></h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">Neural Interface v3.1</p>
        </div>
      </motion.div>

      {/* Status Indicator */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute top-8 right-8 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md"
      >
        {state === 'disconnected' ? (
          <WifiOff className="w-3 h-3 text-red-500" />
        ) : (
          <Wifi className="w-3 h-3 text-futuristic-accent animate-pulse" />
        )}
        <span className="text-[10px] uppercase tracking-widest font-bold text-white/60">
          {state}
        </span>
      </motion.div>

      {/* Main Interaction Area */}
      <div className="relative flex flex-col items-center gap-12">
        {/* Visualizer / Orb */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {state === 'speaking' ? (
              <motion.div
                key="speaking"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-1 h-32"
              >
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      height: [20, Math.random() * 80 + 20, 20],
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 0.5, 
                      delay: i * 0.05 
                    }}
                    className="w-1.5 bg-futuristic-accent rounded-full shadow-[0_0_15px_rgba(242,125,38,0.5)]"
                  />
                ))}
              </motion.div>
            ) : state === 'listening' ? (
              <motion.div
                key="listening"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="w-32 h-32 rounded-full border-2 border-futuristic-accent flex items-center justify-center relative"
              >
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full bg-futuristic-accent/20 blur-xl"
                />
                <Mic className="w-10 h-10 text-futuristic-accent" />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="w-32 h-32 rounded-full border border-white/10 flex items-center justify-center grayscale opacity-30"
              >
                <MicOff className="w-10 h-10 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Central Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleSession}
          className={`
            group relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500
            ${state === 'disconnected' 
              ? 'bg-white/5 border border-white/10 hover:bg-white/10' 
              : 'bg-futuristic-accent shadow-[0_0_30px_rgba(242,125,38,0.4)] border-none'}
          `}
        >
          {state === 'disconnected' ? (
            <Power className="w-8 h-8 text-white/40 group-hover:text-white/80 transition-colors" />
          ) : (
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-white/40" />
              <Volume2 className="w-8 h-8 text-white relative z-10" />
            </div>
          )}
        </motion.button>

        {/* Persona Tagline */}
        <div className="text-center max-w-xs">
          <h2 className="text-white/80 font-medium mb-1">
            {state === 'disconnected' ? "Ready to talk?" : state === 'connecting' ? "Waking up..." : "I'm all ears, babe."}
          </h2>
          <p className="text-xs text-white/30 leading-relaxed">
            {state === 'disconnected' 
              ? "Tap the power button to start your session with Zoya." 
              : "Speak naturally. I can hear you and respond in real-time."}
          </p>
        </div>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-md text-red-500 text-sm font-medium"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Decoration */}
      <div className="absolute bottom-8 w-full px-8 flex justify-between items-end pointer-events-none">
        <div className="flex flex-col gap-1">
          <div className="w-12 h-0.5 bg-futuristic-accent/40" />
          <div className="w-8 h-0.5 bg-futuristic-accent/20" />
        </div>
        <div className="text-[8px] uppercase tracking-[0.4em] text-white/20 font-bold">
          Encrypted Audio Stream
        </div>
        <div className="flex flex-col gap-1 items-end">
          <div className="w-12 h-0.5 bg-futuristic-accent/40" />
          <div className="w-8 h-0.5 bg-futuristic-accent/20" />
        </div>
      </div>
    </div>
  );
}

