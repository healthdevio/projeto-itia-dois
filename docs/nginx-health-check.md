# Health Check no nginx → Core

**Data:** 2026-10-20  
**Arquivo alterado:** `apps/docker/nginx.conf`  
**Objetivo:** Frontend saber se a API (Core) está viva, sem expor o Core diretamente.

---

## O que foi adicionado no `nginx.conf`

```nginx
# Health check: proxy para o Core (para o frontend saber se a API está viva)
location /health {
  set $core_upstream http://core:3001;

  proxy_pass $core_upstream/health;
  proxy_http_version 1.1;

  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  # Timeout curto: health check deve ser rápido
  proxy_connect_timeout 2s;
  proxy_read_timeout 5s;
  proxy_send_timeout 5s;

  # Sem buffering: resposta imediata
  proxy_buffering off;

  # Cache zero: health check deve ser sempre fresco
  add_header Cache-Control "no-cache, no-store, must-revalidate" always;
  add_header Pragma "no-cache" always;
  add_header Expires "0" always;
}
```

---

## O que cada parte faz

| Diretiva                           | Valor                     | Por que                            |
| ---------------------------------- | ------------------------- | ---------------------------------- |
| `proxy_pass $core_upstream/health` | `http://core:3001/health` | Encaminha para `/health` do Core   |
| `proxy_connect_timeout 2s`         | 2 segundos                | Falha rápido se Core não responder |
| `proxy_read_timeout 5s`            | 5 segundos                | Health check deve ser rápido       |
| `proxy_buffering off`              | off                       | Resposta imediata, sem buffer      |
| `Cache-Control: no-cache...`       | always                    | Health check nunca cacheado        |
| `add_header ... always`            | always                    | Headers mesmo em erro (5xx)        |

---

## Fluxo completo

```
Navegador (React)
      │
      ▼ GET /health
┌─────────────────────────────────────┐
│           nginx (porta 80)          │
│  location /health {                 │
│    proxy_pass http://core:3001/health│
│  }                                   │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│      Core (porta 3001)              │
│  GET /health                        │
│  Retorna: { status, database }      │
└─────────────────────────────────────┘
```

---

## Resposta do Core (`GET /health`)

O Core já tem rota `/` que retorna health:

```json
{
  "status": "ok",
  "service": "chat-ai-core",
  "database": "up"
}
```

O frontend chama `GET /health` e recebe isso via nginx.

---

## Como testar

### Local (com stack rodando)

```bash
# No host (se porta 8080 mapeada)
curl http://localhost:8080/health

# No cluster
curl http://<host>:8080/health
```

**Resposta esperada:**

```json
{
  "status": "ok",
  "service": "chat-ai-core",
  "database": "up"
}
```

### Se Core estiver down

```json
{
  "status": "degraded",
  "service": "chat-ai-core",
  "database": "down"
}
```

### Se nginx não achar Core (DNS)

```
502 Bad Gateway
```

(nginx retorna 502 se não resolver `core:3001`)

---

## Por que proxy no nginx e não expor Core direto?

| Aspecto                | Expor Core direto (3001)   | Proxy no nginx                |
| ---------------------- | -------------------------- | ----------------------------- |
| **Segurança**          | Core exposto na internet   | Core só na rede interna       |
| **Header `X-User-Id`** | Cliente manda o que quiser | nginx pode validar/reescrever |
| **SSL/TLS**            | Precisa configurar no Core | Termina no nginx              |
| **Rate limit**         | Difícil no Core            | Fácil no nginx                |
| **Health check**       | Expõe porta 3001           | Só porta 80 exposta           |
| **Single origin**      | CORS necessário            | Mesmo domínio, sem CORS       |

---

## Próximos passos (opcional)

| Melhoria                | O que faz                                |
| ----------------------- | ---------------------------------------- |
| `/health/ready` no Core | Separa "vivo" de "pronto para tráfego"   |
| `/health/live` no Core  | Para Kubernetes/Swarm liveness probe     |
| Banner no React         | Mostra "API offline" se `/health` falhar |
| Métricas de latência    | Tempo de resposta do `/health`           |

---

## Arquivo alterado

`apps/docker/nginx.conf` — adicionado `location /health { ... }` antes do `location /` (SPA fallback).

---

## Validação

```bash
# Config válida?
docker compose -f apps/docker/pw2c/docker-stack.yml config --quiet
# exit=0 = OK
```
