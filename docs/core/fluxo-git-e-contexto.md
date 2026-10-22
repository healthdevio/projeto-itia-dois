# Fluxo de Git e Contexto do Projeto — Chat Omnia

**Data:** 2026-10-21 | **Branch:** `develop` | **Remote:** `itia`

## 1. Fluxo Obrigatório

```bash
git checkout develop && git pull
git checkout -b feat/nome-da-tarefa
# ... alterações ...
git add .
git commit -m "tipo: descrição em português"
git push -u itia feat/nome-da-tarefa
```

### Regras de Commit

| Tipo     | Significado         | Exemplo                       |
| -------- | ------------------- | ----------------------------- |
| `feat:`  | Nova funcionalidade | `feat: adiciona health check` |
| `fix:`   | Correção de bug     | `fix: corrige auth`           |
| `docs:`  | Documentação        | `docs: atualiza leiaute`      |
| `chore:` | Manutenção          | `chore: atualiza .env`        |

### Variáveis Críticas (Portainer)

| Variável            | Valor                                              |
| ------------------- | -------------------------------------------------- |
| `POSTGRES_PASSWORD` | `omniabanco2026`                                   |
| `POSTGRES_USER`     | `omnia_user`                                       |
| `OMNIA_CORE_IMAGE`  | `registry.cloud.grupopw2c.com.br/chat-core:latest` |

---

## 2. Stack e Arquitetura

- **Monorepo** com `chat-core` (Hono/TS) e `chat-omnia` (React/Vite)
- **Banco:** PostgreSQL 16 + pgvector no Swarm (`compute01`)
- **Infra:** Docker Swarm, Portainer, registry `registry.cloud.grupopw2c.com.br`
- **API Gateway:** Nginx (proxy `core:80` → frontend na porta 8080)
- **IA:** Provider `echo` (teste), NVIDIA (produção)

---

## 3. Health Check

- `GET /health` → `{"status":"ok","service":"chat-ai-core","database":"up","timestamp":"..."}`
- `GET /health/ready` → readiness probe (200/503)
- `GET /health/live` → liveness probe (200)

**No Frontend:** Hook `useHealthCheck` faz polling a cada 30s e exibe badge verde/vermelho.

---

## 4. Checklist Pré-Deploy

- [ ] Core rebuild e push da imagem
- [ ] Stack no Portainer com env vars preenchidas
- [ ] 6 secrets no GitHub (2 registry + 4 Portainer)
- [ ] Nó `compute01` confirmado (`docker node ls`)
- [ ] SSL/HTTPS configurado no Load Balancer
- [ ] Health check funcionando: `https://projeto-itia-dois.cloud.grupopw2c.com.br/health`

---

## 5. Problemas Conhecidos

| Sintoma                    | Causa                           | Solução                                    |
| -------------------------- | ------------------------------- | ------------------------------------------ |
| `starting → complete` loop | Variáveis de env inconsistentes | Verificar `POSTGRES_PASSWORD` no Portainer |
| `502 Bad Gateway`          | Nginx sem responder             | `Update the stack` + `Repull image`        |
| `GET / 404`                | Core sem rotas `/health`        | Verificar `index.ts` do Core               |

---

**Última atualização:** 2026-10-21  
**Versão:** 1.0  
**Mantido por:** Equipe Chat Omnia
