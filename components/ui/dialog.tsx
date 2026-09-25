'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X
} from 'lucide-react';

type DialogType = 'success' | 'error' | 'warning' | 'info';

interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: DialogType;
}

interface DialogContextProps {
  showAlert: (message: string, type?: DialogType, title?: string) => void;
  showConfirm: (
    options: Omit<DialogOptions, 'cancelText'> & {
      cancelText?: string;
      onConfirm: () => void;
    }
  ) => void;
  showToast: (message: string, type?: DialogType, title?: string) => void;
}

const DialogContext = createContext<DialogContextProps | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalOptions, setModalOptions] = useState<DialogOptions | null>(null);
  const [isConfirmModal, setIsConfirmModal] = useState(false);

  // Toast State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showAlert = (message: string, type: DialogType = 'info', title?: string) => {
    setIsConfirmModal(false);
    setModalOptions({
      message,
      type,
      title: title || (type === 'error' ? 'Atenção' : type === 'success' ? 'Sucesso' : 'Aviso'),
      confirmText: 'Entendi',
    });
    setModalOpen(true);
  };

  const showConfirm = (options: Omit<DialogOptions, 'cancelText'> & {
    cancelText?: string;
    onConfirm: () => void;
  }) => {
    setIsConfirmModal(true);
    setModalOptions({
      ...options,
      type: options.type || 'warning',
      title: options.title || 'Confirmação',
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
    });
    setModalOpen(true);
  };

  const showToast = (message: string, type: DialogType = 'info', title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = { id, message, type, title };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleClose = () => {
    setModalOpen(false);
    if (modalOptions?.onCancel) {
      modalOptions.onCancel();
    }
  };

  const handleConfirm = () => {
    setModalOpen(false);
    if (modalOptions?.onConfirm) {
      modalOptions.onConfirm();
    }
  };

  const getIcon = (type: DialogType = 'info') => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-6 h-6 text-emerald-600" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-rose-600" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      default:
        return <Info className="w-6 h-6 text-blue-600" />;
    }
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showToast }}>
      {children}

      {/* MODAL POP-UP DO SISTEMA */}
      {modalOpen && modalOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    modalOptions.type === 'error'
                      ? 'bg-rose-50'
                      : modalOptions.type === 'success'
                      ? 'bg-emerald-50'
                      : modalOptions.type === 'warning'
                      ? 'bg-amber-50'
                      : 'bg-blue-50'
                  }`}
                >
                  {getIcon(modalOptions.type)}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="text-base font-bold text-slate-900">
                    {modalOptions.title}
                  </h3>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-line">
                    {modalOptions.message}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              {isConfirmModal && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all"
                >
                  {modalOptions.cancelText || 'Cancelar'}
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                className={`px-5 py-2 text-xs font-semibold rounded-xl text-white shadow-sm transition-all ${
                  modalOptions.type === 'error'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : modalOptions.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-[#0f3b7d] hover:bg-[#0a2e68]'
                }`}
              >
                {modalOptions.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS NOTIFICATIONS */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 p-4 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/80 text-xs animate-in slide-in-from-bottom-3 duration-200"
          >
            <div className="shrink-0 mt-0.5">{getIcon(toast.type)}</div>
            <div className="flex-1 min-w-0">
              {toast.title && (
                <p className="font-bold text-slate-900 mb-0.5">{toast.title}</p>
              )}
              <p className="text-slate-600 leading-normal">{toast.message}</p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog deve ser usado dentro de um DialogProvider');
  }
  return context;
}
