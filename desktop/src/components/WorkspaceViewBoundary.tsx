import { Component, type ErrorInfo, type ReactNode } from "react";

interface WorkspaceViewBoundaryProps {
  children: ReactNode;
  onReturnToAgent: () => void;
}

interface WorkspaceViewBoundaryState {
  failed: boolean;
  retryKey: number;
}

export class WorkspaceViewBoundary extends Component<WorkspaceViewBoundaryProps, WorkspaceViewBoundaryState> {
  state: WorkspaceViewBoundaryState = { failed: false, retryKey: 0 };

  static getDerivedStateFromError(): Partial<WorkspaceViewBoundaryState> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Axiom desktop view failed", error.message, info.componentStack);
  }

  private retry = (): void => {
    this.setState((current) => ({ failed: false, retryKey: current.retryKey + 1 }));
  };

  private returnToAgent = (): void => {
    this.setState({ failed: false, retryKey: this.state.retryKey + 1 });
    this.props.onReturnToAgent();
  };

  render(): ReactNode {
    if (!this.state.failed) return <div key={this.state.retryKey} className="flex-1 min-h-0 flex flex-col">{this.props.children}</div>;

    return (
      <div role="alert" className="flex flex-1 items-center justify-center bg-axiom-bg p-8 text-white">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-base font-semibold">This view could not be displayed</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Your session is still active. Retry this view, or return to the Agent without restarting the app.</p>
          <div className="mt-5 flex gap-3">
            <button type="button" onClick={this.retry} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black">Retry</button>
            <button type="button" onClick={this.returnToAgent} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200">Return to Agent</button>
          </div>
        </div>
      </div>
    );
  }
}
