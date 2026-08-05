import React, { Component, ErrorInfo, ReactNode } from 'react';

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
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let displayMessage = "Ocorreu um erro inesperado.";
      let technicalDetails = "";

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error) {
            displayMessage = "Erro ao acessar o banco de dados. Verifique sua conexão ou permissões.";
            technicalDetails = parsed.error;
          }
        }
      } catch (e) {
        // Not a JSON error
        displayMessage = this.state.error?.message || displayMessage;
      }

      return (
        <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4">
          <div className="bg-white border border-[#141414] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            <h2 className="font-serif italic text-2xl mb-4">Ops! Algo deu errado.</h2>
            <p className="font-mono text-sm mb-6 opacity-70">
              {displayMessage}
            </p>
            {technicalDetails && (
              <pre className="bg-[#141414]/5 p-4 font-mono text-[10px] overflow-auto mb-6 max-h-40">
                {technicalDetails}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#141414] text-[#E4E3E0] py-3 font-mono text-[10px] uppercase hover:bg-[#141414]/90"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
