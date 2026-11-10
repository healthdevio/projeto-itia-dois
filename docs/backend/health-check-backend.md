# Health Check do Backend

**Arquivo:** `apps/chat-back/src/index.ts`
**Endpoints:** `GET /health`, `GET /health/ready`, `GET /health/live`
**Propósito:** Monitoring, Kubernetes/Swarm probes, frontend status indicator

## Rotas Disponíveis

| Rota            | Método | Descrição                                       | Status    |
| --------------- | ------ | ----------------------------------------------- | --------- |
| `/health`       | `GET`  | Health check completo: status, banco, timestamp | 200       |
| `/health/ready` | `GET`  | Readiness probe: 200 se DB up, 503 se down      | 200 / 503 |
| `/health/live`  | `GET`  | Liveness probe: sempre 200                      | 200       |

## Respostas

- `GET /health`: `{"status":"ok","service":"chat-ai-core","database":"up","timestamp":"..."}`
- `GET /health/ready`: `{"status":"pass"}` ou `{"status":"fail","reason":"database_down"}` (503)
- `GET /health/live`: `{"status":"ok"}`

## Implementação

As rotas foram adicionadas em `apps/chat-back/src/index.ts` após os imports. O nginx (`apps/docker/nginx.conf`) já proxyava `/health` para o Backend. Agora o backend responde corretamente, liberando o endpoint.

## Checklist de Deploy

- [ ] Backend rebuild e push da nova imagem
- [ ] Atualizar stack no Portainer (`OMNIA_CORE_IMAGE` → nova tag)
- [ ] `Update the stack` + `Repull image`
- [ ] Testar: `curl https://projeto-itia-dois.cloud.grupopw2c.com.br/health`

---

## Histórico

| Data       | Mudança                                                                          |
| ---------- | -------------------------------------------------------------------------------- |
| 2026-10-20 | Criação: rotas `/health`, `/health/ready`, `/health/live` adicionadas ao Backend |
