import React from 'react';
import { Delete, Equal } from 'lucide-react';

const KEYS = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '-'],
  ['000', '0', '⌫', '+'],
];

const OP_KEYS = new Set(['+', '-', '×', '÷']);

const ExpressionKeypad = ({ onKeyPress, onClear, onBackspace, onEquals, className = '' }) => {
  const handleKey = (key) => {
    if (key === '⌫') {
      onBackspace?.();
      return;
    }
    onKeyPress?.(key);
  };

  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg p-2 ${className}`}>
      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.flat().map((key) => {
          const isOp = OP_KEYS.has(key);
          return (
            <button
              key={key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleKey(key)}
              className={`min-h-[48px] rounded-md text-lg font-medium transition-colors active:scale-[0.98] ${
                isOp
                  ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                  : key === '⌫'
                    ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                    : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-100'
              }`}
            >
              {key === '⌫' ? <Delete size={20} className="mx-auto" /> : key}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-1.5 mt-1.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClear}
          className="min-h-[48px] rounded-md bg-white border border-gray-200 text-lg font-medium text-gray-700 hover:bg-gray-100"
        >
          C
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onEquals}
          className="col-span-3 min-h-[48px] rounded-md bg-indigo-600 text-xl font-semibold text-white hover:bg-indigo-700 inline-flex items-center justify-center gap-2"
        >
          <Equal size={22} />
        </button>
      </div>
    </div>
  );
};

export default ExpressionKeypad;
