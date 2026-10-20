# Health Check Implementation — Complete Guide

**Data:** 2026-10-20  
**Objetivo:** Tornar `https://projeto-itia-dois.cloud.grupopw2c.com.br/health` funcional

---

## Resumo das Mudanças

| Componente         | Arquivo                                              | Mudança                                                |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------ |
| **Core (Backend)** | `apps/chat-core/src/routes/health.ts`                | Novas rotas `/health`, `/health/ready`, `/health/live` |
| **Core (Backend)** | `apps/chat-core/src/index.ts`                        | Registro das rotas de health                           |
| **Frontend**       | `apps/chat-omnia/src/hooks/useHealthCheck.ts`        | Hook React para polling de health                      |
| **Frontend**       | `apps/chat-omnia/src/components/HealthIndicator.tsx` | Componente visual de status                            |
| **Frontend**       | `apps/chat-omnia/src/App.tsx`                        | Integração do HealthIndicator                          |
| **Nginx**          | `apps/docker/nginx.conf`                             | Proxy `/health` + bloco HTTPS comentado                |
| **Documentação**   | `docs/health-check-implementation.md`                | Este documento                                         |

---

## 1. Backend (Core) — Novas Rotas

### Arquivo: `apps/chat-core/src/routes/health.ts`

```typescript
import { Hono } from 'hono';
import { checkDatabase } from '../db/client.js';

const health = new Hono();

health.get('/health', async (c) => {
  const dbOk = await checkDatabase();
  return c.json({
    status: dbOk ? 'ok' : 'degraded',
    service: 'chat-ai-core',
    database: dbOk ? 'up' : 'down',
    timestamp: new Date().toISOString(),
  });
});

health.get('/health/ready', async (c) => {
  const dbOk = await checkDatabase();
  if (!dbOk) return c.json({ ready: false, reason: 'database_unavailable' }, 503);
  return c.json({ ready: true });
});

health.get('/health/live', (c) => c.json({ alive: true }));

export { health };
```

### Rotas disponíveis

| Rota                | Descrição                                 | Status Code |
| ------------------- | ----------------------------------------- | ----------- |
| `GET /health`       | Health completo (status + DB + timestamp) | 200 / 503   |
| `GET /health/ready` | Pronto para tráfego (DB OK)               | 200 / 503   |
| `GET /health/live`  | Processo vivo (liveness)                  | 200         |

### Registro no `index.ts`

```typescript
import { health } from './routes/health.js';
app.route('/', health);  // Registra /health, /health/ready, /health/live
```

---

## 2. Frontend — Hook e Componente

### Hook: `apps/chat-omnia/src/hooks/useHealthCheck.ts`

```typescript
export function useHealthCheck(intervalMs = 30000) {
  const [health, setHealth] = useState<HealthStatus>({...});
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    const res = await fetch('/health', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setHealth({ status: data.status, database: data.database, timestamp: data.timestamp });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, intervalMs);
    return () => clearInterval(interval);
  }, [checkHealth, intervalMs]);

  return { health, error, refetch: checkHealth };
}
```

### Componente: `HealthIndicator.tsx`

```tsx
export function HealthIndicator() {
  const { health, error } = useHealthCheck(30000);

  if (health.status === 'unknown') return null;

  const isHealthy = health.status === 'ok' && health.database === 'up';

  return (
    <div className={isHealthy ? 'bg-green-100...' : 'bg-red-100...'}>
      <span className={health.database === 'up' ? 'bg-green-500' : 'bg-red-500'} />
      <span>{isHealthy ? 'Sistema operacional' : 'API indisponível'}</span>
    </div>
  );
}
```

### Integração no `App.tsx`

```tsx
import HealthIndicator from './components/HealthIndicator';

function App() {
  return (
    <div>
      {/* ... existing code ... */}
      <HealthIndicator />
    </div>
  );
}
```

---

## 3. Nginx — Proxy + HTTPS

### Proxy `/health` (já existente)

```nginx
location /health {
  proxy_pass http://core:3001/health;
  proxy_connect_timeout 2s;
  proxy_read_timeout 5s;
  proxy_buffering off;
  add_header Cache-Control "no-cache, no-store, must-revalidate" always;
}
```

### HTTPS (comentado — pronto para uso)

```nginx
# server {
#   listen 443 ssl http2;
#   server_name projeto-itia-dois.cloud.grupopw2c.com.br;
#
#   ssl_certificate /etc/nginx/ssl/fullchain.pem;
#   ssl_certificate_key /etc/nginx/ssl/privkey.pem;
#
#   ssl_protocols TLSv1.2 TLSv1.3;
#   ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:...;
#   ssl_prefer_server_ciphers off;
#   ssl_session_cache shared:SSL:10m;
#
#   # Mesmos location /api/, /health/, /assets/, /, etc.
# }
```

**Nota:** Em produção on-premise, o SSL geralmente termina no **Load Balancer / Ingress Controller** (Traefik, Traefik, HAProxy, Cloudflare, MetalLB + NGINX Ingress). O nginx do Swarm recebe tráfego **HTTP na porta 80** vindo do Load Balancer. O bloco HTTPS acima está comentado como referência — descomente e configure certificados se o SSL terminar no nginx.

---

## 3. Como Testar

### Local (stack rodando)

```bash
# Via nginx (porta 8080 no host)
curl http://localhost:8080/health

# Direto no Core
curl http://localhost:3001/health
```

### Produção (domínio real)

```bash
curl https://projeto-itia-dois.cloud.grupopw2c.com.br/health
```

### Respostas esperadas

**Sucesso (200):**

```json
{
  "status": "ok",
  "service": "chat-ai-core",
  "database": "up",
  "timestamp": "2026-10-20T18:30:00.000Z"
}
```

**Banco down (503):**

```json
{
  "status": "degraded",
  "service": "chat-ai-core",
  "database": "down",
  "timestamp": "2026-10-20T18:30:00.000Z"
}
```

**Readiness (200/503):**

```bash
curl https://projeto-itia-dois.cloud.grupopw2c.com.br/health/ready
# {"ready": true} ou {"ready": false, "reason": "database_unavailable"} (503)
```

---

## Checklist de Deploy

| Item                                                      | Status |
| --------------------------------------------------------- | ------ |
| Core tem rotas `/health`, `/health/ready`, `/health/live` | ✅     |
| Frontend tem `useHealthCheck` hook                        | ✅     |
| Frontend tem `HealthIndicator` componente                 | ✅     |
| `App.tsx` integra `HealthIndicator`                       | ✅     |
| Nginx tem `location /health` proxy                        | ✅     |
| Nginx tem bloco HTTPS comentado (referência)              | ✅     |
| Stack `docker-stack.yml` válido                           | ✅     |

---

## Próximos Passos (Opcionais)

| Item             | Descrição                                                                   |
| ---------------- | --------------------------------------------------------------------------- |
| **Alerting**     | Configurar Grafana/Uptime Kuma para alertar se `/health/ready` retornar 503 |
| **Métricas**     | Adicionar latência no `/health` response                                    |
| **Dashboard**    | Painel Grafana com status de todos os serviços                              |
| **SSL no nginx** | Descomentar bloco HTTPS + montar certs via volume se SSL terminar no nginx  |

---

## Troubleshooting

| Sintoma                     | Causa                             | Solução                                      |
| --------------------------- | --------------------------------- | -------------------------------------------- |
| `curl /health` retorna HTML | Ordem do `location`               | `/health` deve vir **antes** de `location /` |
| `502 Bad Gateway`           | Core não responde                 | `docker service logs omnia_core`             |
| `503` no `/health/ready`    | Banco down                        | Verificar `omnia_postgres` service           |
| `502` no HTTPS              | Certificado inválido              | Verificar certs + `ssl_certificate` path     |
| Frontend não mostra banner  | `HealthIndicator` não renderizado | Verificar `App.tsx` import                   |
