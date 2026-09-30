// Token matrix math: the arithmetic and the memory traffic behind one decode step, for the "Show the math" view of
// the Tokens part (level 6). Every new token multiplies its vector by every weight in the model once: about two
// FLOPs (a multiply and an add) per weight, and each weight read out of HBM to do it. The model drawn is a published
// open-weights one (ASSUMPTIONS 'token-math-model'); the GPU's figures come from the scenario's accelerator.
// Weights only: the KV cache reads that grow with the context are not counted here.

export const TOKEN_MATH_MODEL = { name: 'Llama 3.1 70B', params: 70e9, paramsText: '70B', precision: 'FP8', bytesPerParam: 1 };

// the GPU's dense math at the precision it publishes a figure for, FP8 first (the model's own precision)
function gpuMath(A) {
  if (A.fp8PF) return { pf: A.fp8PF, precision: 'FP8' };
  if (A.fp4PF) return { pf: A.fp4PF, precision: 'FP4' };
  return { pf: null, precision: null };
}

export function tokenMath(M, model = TOKEN_MATH_MODEL) {
  const A = M.accel, flops = 2 * model.params, bytes = model.params * model.bytesPerParam;
  const { pf, precision } = gpuMath(A), hbmBps = A.hbm.tbs * 1e12, flopsPerS = pf ? pf * 1e15 : null;
  return {
    model, flops, bytes,
    intensity: flops / bytes,                            // FLOPs per byte read, one stream
    balance: flopsPerS ? flopsPerS / hbmBps : null,      // FLOPs per byte this GPU can sustain: its math over its HBM
    mathPrecision: precision, hbmTBs: A.hbm.tbs, pf,
    readS: bytes / hbmBps,                               // streaming every weight through this GPU's HBM once
    mathS: flopsPerS ? flops / flopsPerS : null,         // the same step's arithmetic at the GPU's dense peak
  };
}

const sig = v => v >= 100 ? Math.round(v).toLocaleString('en-US') : v >= 10 ? v.toFixed(0) : v >= 1 ? String(+v.toFixed(1)) : String(+v.toFixed(2));
const ms = s => { const v = s * 1000; return v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v.toFixed(3); };

// the rows the Tokens card shows under "Show the math", each with its evidence (src/evidence.js)
export function tokenMathRows(M) {
  const t = tokenMath(M), m = t.model, A = M.accel;
  const rows = [
    ['Model in the math', `${m.name} at ${m.precision}`, 'assumed', { assume: 'token-math-model', refs: [
      ['meta-llama-3-1-model-card', 'Model Information: “a collection of pretrained and instruction tuned generative models in 8B, 70B and 405B sizes”'],
      ['nvidia-llama-3-1-70b-fp8', 'Model Overview: quantizes “weights and activations of Meta-Llama-3.1-70B-Instruct to FP8 data type”, “reducing the number of bits per parameter from 16 to 8”'],
    ] }],
    ['Arithmetic per token', `≈${sig(t.flops / 1e9)} GFLOP (2 × ${m.paramsText} weights)`, 'derived', { calc: 'token-math-flops' }],
    ['Read from HBM per token', `≈${sig(t.bytes / 1e9)} GB (${m.paramsText} × ${m.bytesPerParam} byte)`, 'derived', { calc: 'token-math-bytes' }],
  ];
  if (t.balance) rows.push(['Arithmetic per byte read', `≈${sig(t.intensity)} FLOP; ${A.short ?? A.id} can do ≈${sig(t.balance)} (${t.mathPrecision})`, 'derived', { calc: 'token-math-intensity' }]);
  rows.push(['One stream on one GPU', `≈${ms(t.readS)} ms reading weights${t.mathS ? ` vs ≈${ms(t.mathS)} ms of math` : ''}`, 'derived', { calc: 'token-math-step-time' }]);
  return rows;
}
