/** Indicative app estimates, not source recipes or validated fermentation predictions.
 * Consulted 2026-10-01: https://www.pizzanapoletana.org/it/ricetta_pizza_napoletana
 * https://www.mulinocaputo.it/prodotti/pizzeria-professional/
 * https://www.molinorachello.it/ https://www.molinosima.it/ https://www.molinosrossetto.com/
 * https://www.molinovigevano.com/ https://www.molinopivetti.it/
 * https://www.lacucinaitaliana.it/ https://www.valeriovalle.it/
 * Protein thresholds, percentages, interpolation anchors, and time limits below are APP CHOICES
 * informed by Italian references, not measurements or recommendations attributed to any one source.
 */
export type Style = 'napoletana' | 'teglia' | 'romana';
export type Band = 'weak' | 'medium' | 'strong';
export type Program = 'room' | 'fridge';
export type Yeast = 'fresh' | 'dry';
export const TRAY_LOAD = 0.5;
export const PROTEIN_MIN = 6;
export const PROTEIN_MAX = 20;

export function proteinBand(protein: number): Band {
  if (!Number.isFinite(protein) || protein < PROTEIN_MIN || protein > PROTEIN_MAX) throw new RangeError('invalid_protein');
  return protein < 11 ? 'weak' : protein <= 12.5 ? 'medium' : 'strong';
}

export function maxFermentationHours(band: Band, program: Program): number {
  // App choice: strong room dough is capped at 48h; fridge: medium 48h, strong 72h.
  return program === 'room' ? { weak: 8, medium: 24, strong: 48 }[band] : { weak: 8, medium: 48, strong: 72 }[band];
}

const hydration: Record<Style, Record<Band, number>> = {
  napoletana: { weak: 57, medium: 60, strong: 62.5 },
  teglia: { weak: 68, medium: 72, strong: 78 },
  romana: { weak: 55, medium: 58, strong: 60 },
};
const roomAnchors = [[2, 2.5], [4, 1.5], [8, 0.5], [12, 0.25], [24, 0.1], [48, 0.05], [72, 0.03]] as const;
const fridgeAnchors = [[12, 0.6], [24, 0.4], [48, 0.25], [72, 0.15]] as const;

/** Interpolate log dose versus log duration; clamp outside the declared anchors. */
export function freshYeastPercent(hours: number, program: Program): number {
  if (!Number.isFinite(hours) || hours <= 0) throw new RangeError('invalid_duration');
  const anchors = program === 'room' ? roomAnchors : fridgeAnchors;
  if (hours <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    const [endHour, endDose] = anchors[i]!;
    if (hours <= endHour) {
      const [beginHour, beginDose] = anchors[i - 1]!;
      const fraction = Math.log(hours / beginHour) / Math.log(endHour / beginHour);
      return Math.exp(Math.log(beginDose) + fraction * Math.log(endDose / beginDose));
    }
  }
  return anchors[anchors.length - 1]![1];
}

export function computeRecipe(input: { style: Style; proteinPercent: number; yeast: Yeast; program: Program; fermentationHours: number }) {
  const band = proteinBand(input.proteinPercent);
  const fresh = freshYeastPercent(input.fermentationHours, input.program);
  return {
    band,
    yeast: input.yeast,
    percentages: {
      water: hydration[input.style][band],
      salt: { napoletana: 2.8, teglia: 2.3, romana: 2.6 }[input.style],
      oil: input.style === 'teglia' ? 3 : 0,
      yeast: input.yeast === 'dry' ? fresh / 3 : fresh,
    },
  };
}
