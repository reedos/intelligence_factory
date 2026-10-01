# Token matrix math: sources (09/30/2026)

The "Show the math" view on level 6's Tokens card needs a model size and a precision. The scenario has neither, so
the math uses a published open-weights model (ASSUMPTIONS `token-math-model`):

- Meta, Llama 3.1 model card, https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/MODEL_CARD.md
  (checked 09/30/2026). Model Information: "a collection of pretrained and instruction tuned generative models in
  8B, 70B and 405B sizes". Model release date: July 23, 2024.
- NVIDIA, Llama-3.1-70B-Instruct-FP8 model card, https://huggingface.co/nvidia/Llama-3.1-70B-Instruct-FP8
  (checked 09/30/2026). Quantizes "weights and activations of Meta-Llama-3.1-70B-Instruct to FP8 data type",
  "reducing the number of bits per parameter from 16 to 8", cutting disk size and GPU memory by about 50%.

Figures derived from them (CALCS `token-math-flops`, `token-math-bytes`, `token-math-intensity`,
`token-math-step-time`): 2 × 70B = 140 GFLOP per token; 70B × 1 byte = 70 GB read from HBM per token (weights only,
one stream, KV cache reads not counted); 2 FLOP per byte against the accelerator's dense peak over its HBM bandwidth
(both already cited in the scenario's accelerator table).
