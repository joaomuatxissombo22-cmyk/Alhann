import React, { useState } from 'react';
import { Building2, CheckCircle2, Lock, LogIn, Mail, ShieldCheck, UserPlus, X } from 'lucide-react';
import {
  ALHAN_OFFICIAL_LOGO_URL,
  MCX_EXPRESS_BENEFICIARY,
  MCX_EXPRESS_OFFICIAL_NUMBER,
} from '../lib/angolaUtils';
import {
  DEFAULT_MASTER_ADMIN_ALIAS,
  DEFAULT_MASTER_ADMIN_PASS,
  DEFAULT_MASTER_ADMIN_USER,
  getStoredMasterAdminCreds,
} from './AlhanAdminPanel';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (email: string, name: string, nif?: string) => void;
  onOpenRegisterCompany: (email?: string, name?: string) => void;
  onTryGoogleSignIn: () => Promise<void>;
  onMasterAdminDirectLogin?: () => void;
  isSigningInGoogle: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenRegisterCompany,
  onTryGoogleSignIn,
  onMasterAdminDirectLogin,
  isSigningInGoogle,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [emailOrNif, setEmailOrNif] = useState('');
  const [password, setPassword] = useState('');
  const [companyResponsible, setCompanyResponsible] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDirectLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = emailOrNif.trim();
    const passTrimmed = password.trim();

    if (!trimmed || trimmed.length < 4) {
      setErrorMsg('Por favor, indique o seu E-mail Corporativo ou NIF da empresa.');
      return;
    }
    if (!passTrimmed || passTrimmed.length < 4) {
      setErrorMsg('Por favor, introduza a sua palavra-passe de acesso.');
      return;
    }

    // Check if the user is logging in with Master Admin credentials
    const storedAdmin = getStoredMasterAdminCreds();
    const userLower = trimmed.toLowerCase();
    const isAdminUser =
      userLower === storedAdmin.username.toLowerCase() ||
      userLower === DEFAULT_MASTER_ADMIN_USER ||
      userLower === DEFAULT_MASTER_ADMIN_ALIAS;
    const isAdminPass =
      passTrimmed === storedAdmin.password || passTrimmed === DEFAULT_MASTER_ADMIN_PASS;

    if (isAdminUser && isAdminPass && onMasterAdminDirectLogin) {
      onClose();
      onMasterAdminDirectLogin();
      return;
    }

    const resolvedEmail = trimmed.includes('@') ? trimmed : `${trimmed}@empresa.ao`;
    onLoginSuccess(resolvedEmail, companyResponsible.trim() || 'Administrador Empresarial', trimmed);
  };

  const handleQuickRegisterRedirect = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenRegisterCompany(
      emailOrNif.includes('@') ? emailOrNif.trim() : '',
      companyResponsible.trim()
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-white text-slate-900 shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src={ALHAN_OFFICIAL_LOGO_URL}
              alt="ALHAN Logo"
              className="h-9 w-auto rounded bg-white px-2 py-1 object-contain"
            />
            <div>
              <h2 className="text-base font-bold tracking-tight font-display">
                Acesso Empresarial ALHAN FACTURA
              </h2>
              <p className="text-[11px] text-slate-400">
                Facturação Electrónica · Conformidade Fiscal Angola
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 bg-slate-100 p-1.5 m-5 mb-0 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorMsg(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-colors ${
              tab === 'login'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Iniciar Sessão</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setErrorMsg(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-colors ${
              tab === 'register'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Criar Conta Empresarial</span>
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 font-medium">
              {errorMsg}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleDirectLogin} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  E-mail Corporativo ou NIF da Empresa *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={emailOrNif}
                    onChange={(e) => setEmailOrNif(e.target.value)}
                    placeholder="Introduza o seu e-mail ou NIF da empresa"
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Palavra-passe de Acesso *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Introduza a sua palavra-passe"
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Entrar no Sistema de Facturação</span>
              </button>

              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>Ainda não possui conta?</span>
                <button
                  type="button"
                  onClick={() => onOpenRegisterCompany()}
                  className="text-sky-700 hover:underline font-semibold"
                >
                  Registar Nova Empresa →
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleQuickRegisterRedirect} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-sky-700" />
                  <span>Registo de Nova Empresa (Angola)</span>
                </p>
                <p className="text-[11px] text-sky-800">
                  Subscrição com activação via Multicaixa Express (<strong>{MCX_EXPRESS_OFFICIAL_NUMBER} — {MCX_EXPRESS_BENEFICIARY}</strong>). A sua conta empresarial é criada limpa, sem dados fictícios.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome do Responsável / Administrador *
                </label>
                <input
                  type="text"
                  required
                  value={companyResponsible}
                  onChange={(e) => setCompanyResponsible(e.target.value)}
                  placeholder="Nome completo do responsável"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  E-mail Corporativo da Empresa *
                </label>
                <input
                  type="email"
                  required
                  value={emailOrNif}
                  onChange={(e) => setEmailOrNif(e.target.value)}
                  placeholder="email@suaempresa.ao"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Prosseguir para Ficha Completa da Empresa</span>
              </button>
            </form>
          )}

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-medium">
              ACESSO ALTERNATIVO
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={onTryGoogleSignIn}
              disabled={isSigningInGoogle}
              className="w-full py-2.5 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>{isSigningInGoogle ? 'A ligar Google...' : 'Autenticar com Conta Google'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
