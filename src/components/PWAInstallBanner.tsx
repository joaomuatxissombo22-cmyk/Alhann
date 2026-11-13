import React, { useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-2 rounded-lg bg-sky-700 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-sky-600 transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{isIOS ? 'Instalar no iOS' : 'Instalar Aplicação'}</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold">
                Instalar ALHAN FACTURA (Computador ou Telemóvel)
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                <strong>No Computador (Chrome / Edge / Brave):</strong>
                <br />
                1. Aceda através de ligação segura <code>https://</code> e clique no ícone de instalação na barra de endereço (canto superior direito) ou no menu <strong>⋮ → Guardar e Partilhar → Instalar página como aplicação</strong>.
              </p>
              <p>
                <strong>No Android (Chrome):</strong>
                <br />
                1. Toque no menu <strong>⋮</strong> no canto superior direito e seleccione <strong>Instalar aplicação</strong> ou <strong>Adicionar ao ecrã principal</strong>.
              </p>
              <p>
                <strong>No iPhone / iPad (Safari):</strong>
                <br />
                1. Toque no botão <strong>Partilhar</strong> na barra inferior e seleccione <strong>Adicionar ao Ecrã Principal</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-lg bg-slate-900 dark:bg-sky-600 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Compreendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC<{ pendingSyncCount?: number }> = ({
  pendingSyncCount = 0,
}) => {
  const isOnline = useOnlineStatus();

  if (isOnline && pendingSyncCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>
        {!isOnline
          ? 'Modo Offline Activo — Os documentos críticos estão armazenados localmente e serão sincronizados automaticamente.'
          : `A sincronizar ${pendingSyncCount} operação(ões) pendente(s)...`}
      </span>
    </div>
  );
};
