import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

export function getEffectivePrice(product: {
  price: number;
  discountedPrice?: number;
  flashSalePrice?: number;
  flashSaleEnd?: string;
}): number {
  const now = new Date();
  if (
    product.flashSalePrice &&
    product.flashSaleEnd &&
    new Date(product.flashSaleEnd) > now
  ) {
    return product.flashSalePrice;
  }
  if (product.discountedPrice && product.discountedPrice > 0 && product.discountedPrice < product.price) {
    return product.discountedPrice;
  }
  return product.price;
}
