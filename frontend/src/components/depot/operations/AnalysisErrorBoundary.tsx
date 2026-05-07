"use client";

import React, { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AnalysisErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to monitoring service (console for now)
    console.error("AnalysisSection Error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-[#F04A4A] mb-4" />
          <h3 className="text-[16px] font-bold text-[#E8EDF8] mb-2">
            Something went wrong
          </h3>
          <p className="text-[12px] text-[#8A9BBF] mb-4">
            {this.state.error?.message || "An unexpected error occurred in the Analysis section."}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 rounded-lg bg-[#E5521A] text-white text-[11px] font-bold hover:bg-[#FF7A42] transition"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
