import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: unknown, info: ErrorInfo): void {
    const message = error instanceof Error ? error.message : "Unknown React error";
    console.error("ORBIT desktop UI error", {
      message: message.slice(0, 500),
      componentStack: info.componentStack?.slice(0, 1500),
    });
  }

  public render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <section className="card" role="alert" style={{ maxWidth: 640, textAlign: "center" }}>
          <h1>تعذر إكمال عرض ORBIT</h1>
          <p>
            حدث خطأ غير متوقع في الواجهة. بيانات runtime وSQLite لم يتم حذفها بسبب هذا الخطأ.
          </p>
          <button
            className="button primary"
            type="button"
            onClick={() => {
              window.location.reload();
            }}
          >
            إعادة تحميل الواجهة
          </button>
        </section>
      </main>
    );
  }
}
