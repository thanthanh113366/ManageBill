import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import ExpressionKeypad from './ExpressionKeypad';
import {
  normalizeExpression,
  parseMoneyExpression,
  previewMoneyExpression,
  sanitizeMoneyExpression,
} from '../utils/parseMoneyExpression';
import { formatVND } from '../utils/pnlCalculations';

const OP_KEYS = new Set(['+', '-', '*', '/']);

const ExpressionAmountInput = forwardRef(
  (
    {
      value,
      onChange,
      placeholder = 'VD: 280000+50000',
      className = '',
      disabled = false,
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const inputRef = useRef(null);

    useImperativeHandle(ref, () => inputRef.current);

    useEffect(() => {
      if (!open) return undefined;

      const onPointerDown = (e) => {
        if (rootRef.current && !rootRef.current.contains(e.target)) {
          setOpen(false);
        }
      };

      document.addEventListener('mousedown', onPointerDown);
      document.addEventListener('touchstart', onPointerDown);
      return () => {
        document.removeEventListener('mousedown', onPointerDown);
        document.removeEventListener('touchstart', onPointerDown);
      };
    }, [open]);

    const preview = previewMoneyExpression(value);
    const parsed = parseMoneyExpression(value);

    const appendKey = (key) => {
      const opMap = { '×': '*', '÷': '/' };
      const token = opMap[key] || key;

      if (OP_KEYS.has(token)) {
        const normalized = normalizeExpression(value);
        if (!normalized || /[+\-*/]$/.test(normalized)) return;
        onChange(`${normalized}${token}`);
        return;
      }

      onChange(`${value || ''}${token}`);
    };

    const handleBackspace = () => {
      onChange(String(value || '').slice(0, -1));
    };

    const handleClear = () => {
      onChange('');
    };

    const handleEquals = () => {
      if (!parsed.ok) return;
      onChange(String(parsed.value));
      setOpen(false);
    };

    const handlePaste = (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text');
      const sanitized = sanitizeMoneyExpression(text);
      if (sanitized) onChange(sanitized);
    };

    return (
      <div ref={rootRef} className={`relative ${className}`}>
        <input
          ref={inputRef}
          type="text"
          inputMode="none"
          readOnly
          disabled={disabled}
          value={value}
          onClick={() => !disabled && setOpen(true)}
          onFocus={() => !disabled && setOpen(true)}
          onPaste={handlePaste}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 cursor-pointer bg-white"
          aria-expanded={open}
          aria-haspopup="true"
        />

        {value && (
          <p className="mt-1 text-xs text-gray-500 truncate">
            {parsed.ok ? (
              <span>= {formatVND(parsed.value)}</span>
            ) : parsed.incomplete && preview !== null ? (
              <span>= {formatVND(preview)}</span>
            ) : parsed.incomplete ? (
              <span className="text-gray-400">Đang nhập...</span>
            ) : (
              <span className="text-red-500">Biểu thức không hợp lệ</span>
            )}
          </p>
        )}

        {open && (
          <>
            <div className="hidden sm:block absolute z-20 left-0 right-0 mt-1 shadow-lg">
              <ExpressionKeypad
                onKeyPress={appendKey}
                onBackspace={handleBackspace}
                onClear={handleClear}
                onEquals={handleEquals}
              />
            </div>

            <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 p-3 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.12)]">
              <div className="mb-2 px-1">
                <p className="text-sm font-medium text-gray-900 truncate">{value || placeholder}</p>
                {parsed.ok && (
                  <p className="text-xs text-indigo-600">= {formatVND(parsed.value)}</p>
                )}
              </div>
              <ExpressionKeypad
                onKeyPress={appendKey}
                onBackspace={handleBackspace}
                onClear={handleClear}
                onEquals={handleEquals}
              />
            </div>
          </>
        )}
      </div>
    );
  }
);

ExpressionAmountInput.displayName = 'ExpressionAmountInput';

export default ExpressionAmountInput;
