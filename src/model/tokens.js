// Token arithmetic for the calculator, the story and the journeys. calc holds the reader's settings.
export const calc = { tokPerGpu: 2000, tpsTouched: false, util: 0.6, carbon: 370, trainGWh: 50, lifeTokens: 1e15, withTrain: true };
export function tokenFigures(M, c = calc) {
  const tps = c.tpsTouched ? c.tokPerGpu : M.tokPerGpuRef;   // each accelerator gets its own default until the reader sets one
  const rate = M.gpus * tps * c.util;
  const jOps = M.meterMW * 1e6 / rate;
  const jTrain = c.withTrain ? c.trainGWh * 3.6e12 / c.lifeTokens : 0;
  const j = jOps + jTrain, whReply = j * 500 / 3600;
  return { rate, j, jTrain, whReply, co2Reply: whReply / 1000 * c.carbon, waterReply: whReply / 1000 * M.wue * 1000 };
}
