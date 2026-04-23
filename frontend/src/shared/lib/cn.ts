import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Standard `cn` helper for tailwind class composition. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

