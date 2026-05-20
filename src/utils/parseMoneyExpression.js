/**
 * Parse & evaluate biểu thức tiền VND an toàn (không dùng eval).
 * Hỗ trợ: + - * / với ưu tiên ×÷ trước +−
 */

export const normalizeExpression = (expr) =>
  String(expr ?? '')
    .replace(/\s+/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/');

const OP_PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2 };

const tokenize = (expr) => {
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    const c = expr[i];
    if (c >= '0' && c <= '9') {
      let num = '';
      while (i < expr.length && expr[i] >= '0' && expr[i] <= '9') {
        num += expr[i];
        i += 1;
      }
      tokens.push({ type: 'num', value: Number(num) });
    } else if ('+-*/'.includes(c)) {
      tokens.push({ type: 'op', value: c });
      i += 1;
    } else {
      throw new Error('invalid_char');
    }
  }

  return tokens;
};

const toRpn = (tokens) => {
  const output = [];
  const ops = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token.type === 'num') {
      output.push(token);
      continue;
    }

    if (i === 0 || tokens[i - 1].type === 'op') {
      throw new Error('invalid_operator');
    }

    while (
      ops.length > 0 &&
      ops[ops.length - 1].type === 'op' &&
      OP_PRECEDENCE[ops[ops.length - 1].value] >= OP_PRECEDENCE[token.value]
    ) {
      output.push(ops.pop());
    }
    ops.push(token);
  }

  while (ops.length > 0) {
    const op = ops.pop();
    if (op.type !== 'op') throw new Error('invalid');
    output.push(op);
  }

  return output;
};

const evalRpn = (rpn) => {
  const stack = [];

  for (const token of rpn) {
    if (token.type === 'num') {
      stack.push(token.value);
      continue;
    }

    if (stack.length < 2) throw new Error('invalid');
    const b = stack.pop();
    const a = stack.pop();

    switch (token.value) {
      case '+':
        stack.push(a + b);
        break;
      case '-':
        stack.push(a - b);
        break;
      case '*':
        stack.push(a * b);
        break;
      case '/':
        if (b === 0) throw new Error('divide_by_zero');
        stack.push(a / b);
        break;
      default:
        throw new Error('invalid');
    }
  }

  if (stack.length !== 1) throw new Error('invalid');
  return stack[0];
};

const evaluateNormalized = (normalized) => {
  if (!normalized) throw new Error('empty');
  if (!/^[\d+\-*/]+$/.test(normalized)) throw new Error('invalid_char');

  const tokens = tokenize(normalized);
  if (tokens.length === 0) throw new Error('empty');
  if (tokens[0].type === 'op' || tokens[tokens.length - 1].type === 'op') {
    throw new Error('invalid_operator');
  }

  const rpn = toRpn(tokens);
  return evalRpn(rpn);
};

/**
 * @returns {{ ok: true, value: number, expression: string } | { ok: false, error: string, incomplete?: boolean }}
 */
export const parseMoneyExpression = (expr) => {
  const expression = normalizeExpression(expr);

  if (!expression) {
    return { ok: false, error: 'empty' };
  }

  if (/[+\-*/]$/.test(expression)) {
    return { ok: false, error: 'incomplete', incomplete: true, expression };
  }

  try {
    const raw = evaluateNormalized(expression);
    if (!Number.isFinite(raw)) {
      return { ok: false, error: 'not_finite', expression };
    }
    return {
      ok: true,
      value: Math.round(raw),
      expression,
    };
  } catch (err) {
    const code = err?.message || 'invalid';
    return { ok: false, error: code, expression };
  }
};

/** Preview kết quả; trả về null nếu biểu thức chưa hoàn chỉnh hoặc lỗi */
export const previewMoneyExpression = (expr) => {
  const parsed = parseMoneyExpression(expr);
  if (parsed.ok) return parsed.value;
  if (parsed.incomplete) return null;
  return null;
};

/** Chỉ giữ ký tự hợp lệ khi paste */
export const sanitizeMoneyExpression = (raw) =>
  normalizeExpression(raw).replace(/[^\d+\-*/]/g, '');
