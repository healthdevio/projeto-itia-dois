import { useState, useEffect, useCallback } from 'react';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'unknown';
  database: 'up' | 'down' | 'unknown';
  timestamp?: string;
}

export function useHealthCheck(intervalMs = 30000) {
  const [health, setHealth] = useState<HealthStatus>({
    status: 'unknown',
    database: 'unknown',
  });
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/health', {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setHealth({
          status: data.status,
          database: data.database,
          timestamp: data.timestamp,
        });
        setError(null);
      } else {
        setHealth({ status: 'degraded', database: 'down' });
        setError(`HTTP ${res.status}`);
      }
    } catch (e) {
      setHealth({ status: 'degraded', database: 'down' });
      setError(e instanceof Error ? e.message : 'Erro de rede');
    }
  }, []);

  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timeoutId = setTimeout(checkHealth, 0);

    const interval = setInterval(checkHealth, intervalMs);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [checkHealth, intervalMs]);

  return { health, error, refetch: checkHealth };
}
