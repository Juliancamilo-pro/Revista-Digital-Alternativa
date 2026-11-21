import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Error inesperado al renderizar la página.',
    };
  }

  override componentDidCatch(error: Error) {
    console.error('ErrorBoundary capturó un error:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F6F1] dark:bg-[#0D0D0D] text-[#111111] dark:text-[#F4F1EA] p-6">
          <div className="max-w-lg w-full border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#161616] p-8">
            <p className="font-display text-xs uppercase tracking-widest text-[#B91C1C] font-bold">
              Aviso del sistema
            </p>
            <h1 className="font-display text-3xl font-bold mt-2">
              Ocurrió un inconveniente al cargar esta vista
            </h1>
            <p className="mt-3 text-base text-neutral-600 dark:text-neutral-300 leading-relaxed">
              {this.state.message.startsWith('{')
                ? 'No tienes permisos suficientes para esta operación o la sesión ha expirado.'
                : this.state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = '/';
              }}
              className="mt-6 px-5 py-2.5 bg-[#B91C1C] text-white font-display font-bold uppercase tracking-wider text-sm cursor-pointer hover:bg-[#991B1B]"
            >
              Volver a la portada
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
