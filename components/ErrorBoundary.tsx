'use client';

import React from 'react';

interface Props {
  fallback?: (err: Error, reset: () => void) => React.ReactNode;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Minimal client-side error boundary. We use it around the dynamically
 * imported ReactFlow Canvas so a single render-time crash doesn't show the
 * default Next.js red overlay forever.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface to the console so dev-tools / Sentry can pick it up.
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="flex h-screen w-full items-center justify-center bg-white p-6">
          <div className="max-w-md space-y-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="text-lg font-semibold text-red-700">
              Something went wrong
            </h2>
            <p className="text-sm text-red-600">
              {this.state.error.message || 'Unknown error'}
            </p>
            <button
              onClick={this.reset}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
