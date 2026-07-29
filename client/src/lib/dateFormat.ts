export function formatDate(date: string | Date | null | undefined, includeTime: boolean = false): string {
  if (date === null || date === undefined) return '—';
  // If already in DD.MM.YYYY format, return as is
  if (typeof date === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(date)) {
    return date;
  }
  
  // If in YYYY-MM-DD format, convert to DD.MM.YYYY
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `${day}.${month}.${year}`;
  }
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Check if date is valid
  if (isNaN(d.getTime())) {
    return typeof date === 'string' ? date : '';
  }
  
  // Convert to Tashkent time (UTC+5)
  const tashkent = new Date(d.getTime() + (5 * 60 + d.getTimezoneOffset()) * 60000);
  
  const day = String(tashkent.getDate()).padStart(2, '0');
  const month = String(tashkent.getMonth() + 1).padStart(2, '0');
  const year = tashkent.getFullYear();
  
  if (includeTime) {
    const hours = String(tashkent.getHours()).padStart(2, '0');
    const minutes = String(tashkent.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }
  
  return `${day}.${month}.${year}`;
}
