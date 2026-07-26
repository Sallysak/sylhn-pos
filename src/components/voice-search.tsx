"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceSearchProps {
  onResult: (text: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Voice Search — uses the Web Speech API for voice-to-text product search.
 * Works in Chrome, Edge, and Safari (mobile). Not supported in Firefox.
 *
 * When the user clicks the mic button, the browser asks for microphone
 * permission. Once granted, the user speaks and the text is passed to
 * the onResult callback (which typically fills the search input).
 */
export function VoiceSearch({ onResult, className, disabled }: VoiceSearchProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          onResult(transcript);
          setListening(false);
        };

        recognition.onerror = () => {
          setListening(false);
        };

        recognition.onend = () => {
          setListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [onResult]);

  const toggle = () => {
    if (!supported || !recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={listening ? "Listening... click to stop" : "Voice search — speak a product name"}
      className={cn(
        "flex items-center justify-center h-8 w-8 rounded-lg transition active:scale-95 shrink-0",
        listening
          ? "bg-rose-500 text-white animate-pulse"
          : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400",
        disabled && "opacity-40 cursor-not-allowed",
        className
      )}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
