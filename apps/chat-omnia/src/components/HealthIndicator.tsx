import { useHealthCheck } from '../hooks/useHealthCheck';

export default function HealthIndicator() {
  const { health, error } = useHealthCheck(30000);

  if (health.status === 'unknown') return null;

  const isHealthy = health.status === 'ok' && health.database === 'up';

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
        ${
          isHealthy
            ? 'bg-green-100 text-green-800 border border-green-300'
            : 'bg-red-100 text-red-800 border border-red-300'
        }
      `}
      role="status"
      aria-live="polite"
    >
      <span
        className={`
          w-2 h-2 rounded-full
          ${health.database === 'up' ? 'bg-green-500' : 'bg-red-500'}
        `}
        aria-hidden="true"
      />
      <span>
        {isHealthy ? 'Sistema operacional' : 'API indisponível'}
        {error && <span className="ml-2 text-xs opacity-75">({error})</span>}
      </span>
    </div>
  );
}
