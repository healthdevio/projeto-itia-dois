# Health Check — Core (Backend)

**Arquivo:** `apps/chat-core/src/index.ts`  
**Endpoints:** `GET /health`, `GET /health/ready`, `GET /health/live`  
**Propósito:** Monitoring, Kubernetes/Swarm probes, frontend status indicator

---

## Rotas Disponíveis

| Rota            | Método | Descrição                                               | Status Code |
| --------------- | ------ | ------------------------------------------------------- | ----------- |
| `/health`       | `GET`  | Health check completo: status, banco, timestamp         | 200         |
| `/health/ready` | `GET`  | Readiness probe: retorna 200 se DB está up, 503 se down | 200 / 503   |
| `/health/live`  | `GET`  | Liveness probe: sempre retorna 200 (serviço vivo)       | 200         |

---

## Respostas

### `GET /health`

```json
{
  "status": "ok",
  "service": "chat-ai-core",
  "database": "up",
  "timestamp": "2026-10-20T16:30:00.000Z"
}
```

- `status`: `ok` ou `degraded`
- `service`: sempre `chat-ai-core`
- `database`: `up` ou `down` (baseado em `checkDatabase()`)
- `timestamp`: ISO 8601

### `GET /health/ready`

```json
// Sucesso
{ "status": "pass" }

// Falha (DB down)
{ "status": "fail", "reason": "database_down" }
```

- Retorna **200** se o banco de dados estiver conectado
- Retorna **503** se o banco de dados não estiver disponível
- Usado por Kubernetes/Swarm para determinar se o pod/serviço pode receber tráfego

### `GET /health/live`

```json
{ "status": "ok" }
```

- Sempre retorna **200** (enquanto o processo estiver rodando)
- Usado por Kubernetes/Swarm para determinar se o container ainda está vivo

---

## Implementação

As rotas foram adicionadas em `apps/chat-core/src/index.ts` após os imports:

```typescript
// Health check routes
app.get('/health', async (c) => {
  const databaseUp = await checkDatabase();
  const timestamp = new Date().toISOString();
  return c.json({
    status: databaseUp ? 'ok' : 'degraded',
    service: 'chat-ai-core',
    database: databaseUp ? 'up' : 'down',
    timestamp,
  });
});

app.get('/health/ready', async (c) => {
  const databaseUp = await checkDatabase();
  if (databaseUp) {
    return c.json({ status: 'pass' });
  }
  return c.json({ status: 'fail', reason: 'database_down' }, 503);
});

app.get('/health/live', async (c) => {
  return c.json({ status: 'ok' });
});
```

---

## Integração com Nginx

O nginx (`apps/docker/nginx.conf`) já proxyava `/health` para o Core:

```nginx
location /health {
  set $core_upstream http://core:3001;
  proxy_pass $core_upstream/health;
  proxy_buffering off;
  add_header Cache-Control "no-cache, no-store, must-revalidate" always;
  add_header Pragma "no-cache" always;
  add_header Expires "0" always;
}
```

Com as rotas agora registradas no Core, o fluxo completa:

1. Cliente → `GET https://projeto-itia-dois.cloud.grupopw2c.com.br/health`
2. nginx → proxy para `http://core:3001/health`
3. Core app → retorna JSON de status

---

## Checklist de Deploy

- [ ] Core rebuild e push da nova imagem para o registry
- [ ] Atualizar stack no Portainer (`OMNIA_CORE_IMAGE` → nova tag)
- [ ] `Update the stack` + `Repull image` no Portainer
- [ ] Testar: `curl https://projeto-itia-dois.cloud.grupopw2c.com.br/health`
- [ ] Verificar `/health/ready` e `/health/live` também funcionando

---

## Histórico

| Data       | Mudança                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| 2026-10-20 | Criação: rotas `/health`, `/health/ready`, `/health/live` adicionadas ao Core |
