export type TrayShape =
  | { kind: 'rectangle'; lengthCm: number; widthCm: number }
  | { kind: 'circle'; diameterCm: number };

export function trayAreaCm2(shape: TrayShape): number {
  const dimensions = shape.kind === 'rectangle' ? [shape.lengthCm, shape.widthCm] : [shape.diameterCm];
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) throw new RangeError('invalid_dimensions');
  return shape.kind === 'rectangle'
    ? shape.lengthCm * shape.widthCm
    : Math.PI * (shape.diameterCm / 2) ** 2;
}

export function doughMassForTray(shape: TrayShape, loadGramsPerCm2: number): number {
  if (!Number.isFinite(loadGramsPerCm2) || loadGramsPerCm2 <= 0) throw new RangeError('invalid_load');
  return trayAreaCm2(shape) * loadGramsPerCm2;
}
