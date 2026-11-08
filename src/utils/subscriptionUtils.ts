/**
 * Shared utility for calculating subscription remaining days consistently
 * across AdminPanel and ProfileView.
 * Exclusively uses premiumUntil as the official source of truth for expiring plans.
 */
export function calculateRemainingDays(
  premiumUntil?: string | Date | any,
  isLifetime: boolean = false,
  isLucasUser: boolean = false,
  currentTime: number = Date.now()
): number | 'ilimitado' {
  if (isLucasUser || isLifetime) return 'ilimitado';

  if (!premiumUntil) return 0;

  let expiryDate: Date | null = null;

  if (premiumUntil instanceof Date) {
    expiryDate = premiumUntil;
  } else if (typeof premiumUntil.toDate === 'function') {
    expiryDate = premiumUntil.toDate();
  } else if (typeof premiumUntil.seconds === 'number') {
    expiryDate = new Date(premiumUntil.seconds * 1000);
  } else {
    expiryDate = new Date(premiumUntil);
  }

  if (expiryDate && !isNaN(expiryDate.getTime())) {
    const diffTime = expiryDate.getTime() - currentTime;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  return 0;
}

