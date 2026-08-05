import { addDays } from 'date-fns';

/**
 * SM-2 Algorithm implementation
 * @param quality 0-5 (0: total blackout, 5: perfect response)
 * @param repetitions Number of successful repetitions
 * @param previousInterval Previous interval in days
 * @param previousEase Previous easiness factor
 * @returns { interval: number, ease: number, repetitions: number }
 */
export function calculateNextReview(
  quality: number,
  repetitions: number = 0,
  previousInterval: number = 0,
  previousEase: number = 2.5,
  baseDate: Date = new Date()
) {
  // Safe fallbacks for any missing/corrupted values
  const q = isNaN(quality) || quality === null || quality === undefined ? 4 : quality;
  const reps = isNaN(repetitions) || repetitions === null || repetitions === undefined ? 0 : repetitions;
  const prevInterval = isNaN(previousInterval) || previousInterval === null || previousInterval === undefined ? 0 : previousInterval;
  const prevEase = isNaN(previousEase) || previousEase === null || previousEase === undefined ? 2.5 : previousEase;

  let interval: number;
  let ease: number;
  let nextRepetitions: number;

  if (q >= 3) {
    if (reps === 0) {
      interval = 1;
    } else if (reps === 1) {
      interval = 6;
    } else {
      interval = Math.round(prevInterval * prevEase);
    }
    nextRepetitions = reps + 1;
  } else {
    interval = 1;
    nextRepetitions = 0;
  }

  // Ensure interval is a valid positive number
  if (isNaN(interval) || interval < 1) {
    interval = 1;
  }

  const calculatedEase = prevEase + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  ease = isNaN(calculatedEase) ? 2.5 : calculatedEase;
  if (ease < 1.3) ease = 1.3;

  return {
    interval,
    ease,
    repetitions: nextRepetitions,
    nextReviewDate: addDays(baseDate, interval).toISOString(),
  };
}

export function accuracyToQuality(correct: number, total: number): number {
  if (total === 0) return 4; // Default to good for quick reviews
  const accuracy = correct / total;
  if (accuracy >= 0.95) return 5;
  if (accuracy >= 0.85) return 4;
  if (accuracy >= 0.70) return 3;
  if (accuracy >= 0.50) return 2;
  if (accuracy >= 0.30) return 1;
  return 0;
}
