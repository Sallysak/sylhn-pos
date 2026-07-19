"use client";
import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-md text-center ring-1 ring-slate-700">
            <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
            </div>
            <h1 className="text-lg font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-xs text-slate-400 mb-4">
              The app encountered an unexpected error. Your data is safe — try refreshing.
              If the problem persists, contact support.
            </p>
            {this.state.error?.message && (
              <div className="bg-slate-900 rounded-lg p-2 mb-4 text-[10px] font-mono text-rose-400 overflow-auto max-h-20">
                {this.state.error.message}
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <button onClick={() => window.location.reload()} className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> Reload App
              </button>
              <a href="/" className="h-10 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold flex items-center gap-2">
                <Home className="h-4 w-4" /> Home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
