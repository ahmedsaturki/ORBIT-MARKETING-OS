import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // Error details stay in the UI state and are not written to console logs.
  }

  private handleReset = () => {
    try {
      localStorage.clear();
    } catch (e) {
      // ignore
    }
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">حدث خطأ غير متوقع</h2>
              <p className="text-xs text-slate-400 mt-1">
                واجه التطبيق استثناءً أثناء معالجة البيانات أو العرض. يمكنك إعادة تهيئة الجلسة واستعادة الحالة الأصلية.
              </p>
              {this.state.error?.message && (
                <pre className="mt-3 p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-rose-300 text-[11px] font-mono overflow-x-auto text-right">
                  {this.state.error.message}
                </pre>
              )}
            </div>
            <button
              onClick={this.handleReset}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة تعيين البيانات واستئناف التطبيق</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
