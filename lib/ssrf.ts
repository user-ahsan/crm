export function isPrivateHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local')) {
      return true;
    }

    const parts = hostname.split('.');
    if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
      const first = parseInt(parts[0], 10);
      const second = parseInt(parts[1], 10);
      if (first === 10) return true;
      if (first === 172 && second >= 16 && second <= 31) return true;
      if (first === 192 && second === 168) return true;
      if (first === 169 && second === 254) return true;
      if (first === 100 && second >= 64 && second <= 127) return true;
    }

    if (hostname === '169.254.169.254') return true;

    return false;
  } catch {
    return true;
  }
}
