import { Component } from 'react';
import Icon from './Icon';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page error:', error, info);
    try {
      this.setState({ stack: String((info && info.componentStack) || '').slice(0, 600) });
    } catch { /* ignore */ }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-10 text-center max-w-lg mx-auto mt-10">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-[#DC2626] flex items-center justify-center mb-3">
          <Icon name="alerttriangle" size={22} />
        </div>
        <h2 className="text-lg font-head font-extrabold text-[#111827]">Something went wrong</h2>
        <p className="text-sm text-[#6B7280] mt-1.5 break-words">{String(this.state.error?.message || this.state.error)}</p>
        {this.state.stack ? (
          <details className="mt-3 text-left">
            <summary className="text-xs font-bold text-[#6B7280] cursor-pointer">Error details</summary>
            <pre className="mt-2 p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] text-[10px] leading-relaxed text-[#475569] overflow-x-auto whitespace-pre-wrap break-words">{this.state.stack}</pre>
          </details>
        ) : null}
        <div className="flex gap-2 mt-4 justify-center">
          <button
            onClick={() => { this.setState({ error: null }); }}
            className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-xs font-bold text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          >
            Retry
          </button>
          {this.props.onReset && (
            <button
              onClick={() => { this.setState({ error: null }); this.props.onReset(); }}
              className="px-4 py-2 rounded-lg bg-xevera-600 text-white text-xs font-bold hover:bg-xevera-700 transition-colors cursor-pointer"
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }
}