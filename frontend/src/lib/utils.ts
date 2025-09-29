/**
 * Utility functions for the APEX application
 */

/**
 * Format a number as currency in GBP
 */
// export function formatCurrency(amount: number | string): string {
//   const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

//   if (isNaN(numAmount)) {
//     return "£0.00";
//   }

//   return new Intl.NumberFormat("en-GB", {
//     style: "currency",
//     currency: "GBP",
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   }).format(numAmount);
// }

/**
 * Format a number as percentage
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  if (isNaN(value)) {
    return "0.00%";
  }

  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a date string
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * Format a date and time string
 */
export function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

/**
 * Truncate text to a specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + "...";
}

/**
 * Generate a random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert snake_case to Title Case
 */
export function snakeToTitle(str: string): string {
  return str
    .split("_")
    .map((word) => capitalize(word))
    .join(" ");
}
