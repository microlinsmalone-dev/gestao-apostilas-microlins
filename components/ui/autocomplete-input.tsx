'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface AutocompleteItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  rawData?: any;
}

interface AutocompleteInputProps {
  id?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  onSelect: (item: AutocompleteItem) => void;
  onCommitWithoutSelection?: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  suggestions: AutocompleteItem[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  emptyMessage?: string;
  minChars?: number;
}

export function AutocompleteInput({
  id,
  inputRef,
  value,
  onChange,
  onSelect,
  onCommitWithoutSelection,
  onKeyDown,
  onBlur,
  suggestions,
  placeholder,
  className = '',
  disabled = false,
  emptyMessage,
  minChars = 1,
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);

  // Combina o inputRef externo com o interno
  const setCombinedRef = useCallback(
    (node: HTMLInputElement | null) => {
      internalInputRef.current = node;
      if (typeof inputRef === 'function') {
        inputRef(node);
      } else if (inputRef && 'current' in inputRef) {
        (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    },
    [inputRef]
  );

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reseta índice destacado quando as sugestões mudam
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (val.trim().length >= minChars) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleInputFocus = () => {
    if (value.trim().length >= minChars && suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        return;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          e.preventDefault();
          const selected = suggestions[highlightedIndex];
          onSelect(selected);
          setIsOpen(false);
          return;
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
    }

    // Se pressionar Enter ou Tab sem sugestão selecionada, permite avanço normal
    if (e.key === 'Enter') {
      setIsOpen(false);
      if (onCommitWithoutSelection) {
        onCommitWithoutSelection(value);
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  const handleItemClick = (item: AutocompleteItem) => {
    onSelect(item);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        id={id}
        ref={setCombinedRef}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDownInternal}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />

      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[280px] bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          <div className="py-1">
            {suggestions.map((item, idx) => {
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => {
                    // Evita perder o foco antes do clique registrar
                    e.preventDefault();
                  }}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full text-left px-3 py-2 flex flex-col transition-colors border-b border-slate-50 last:border-0 ${
                    isHighlighted
                      ? 'bg-blue-50 text-[#0f3b7d]'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs truncate">
                      {item.title}
                    </span>
                    {item.badge && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-[#0f3b7d] shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {item.subtitle && (
                    <span className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {item.subtitle}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isOpen && suggestions.length === 0 && emptyMessage && value.trim().length >= minChars && (
        <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-lg shadow-md border border-slate-200 z-50 p-2.5 text-center text-xs text-slate-400">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
