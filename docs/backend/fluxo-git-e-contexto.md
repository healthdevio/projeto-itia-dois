# Fluxo de Trabalho Git e Contexto do Projeto — Chat Omnia

## Data: 2026-10-21

## Branch atual: `develop` | Remote: `itia`

---

## 1. Fluxo Obrigatório para Qualquer Commit

```bash
# 1. Sempre partir de develop atualizado
git checkout develop
git pull origin develop

# 2. Criar branch feature a partir de develop
git checkout -b feat/nome-da-tarefa

# 3. Fazer as alterações (código, docs, configs)

# 4. Add e commit
git add .
git commit -m "tipo: descrição clara em português"

# 5. Push para o remote
git push -u itia feat/nome-da-tarefa
```

### Regras de Commit (Conventional Commits em Português)

| Tipo        | Significado                              | Exemplo                                 |
| ----------- | ---------------------------------------- | --------------------------------------- |
| `feat:`     | Nova funcionalidade                      | `feat: adiciona rotas de health check`  |
| `fix:`      | Correção de bug                          | `fix: corrige password auth no core`    |
| `docs:`     | Documentação                             | `docs: adiciona markdown de contexto`   |
| `refactor:` | Refatoração sem mudança de comportamento | `refactor: reorganiza variáveis de env` |
| `chore:`    | Tarefas de manutenção, configs           | `chore: atualiza .env.example`          |
| `style:`    | Formatação, whitespace                   | `style: ajuste de formatação`           |
| `test:`     | Adição/alteração de testes               | `test: adiciona testes de health check` |

### Exemplos de Mensagens de Commit

| Cenário                 | Mensagem                                                             |
| ----------------------- | -------------------------------------------------------------------- |
| Nova feature            | `feat: adiciona rotas /health, /health/ready e /health/live ao Core` |
| Correção de bug         | `fix: corrige password authentication no core`                       |
| Atualização de docs     | `docs: atualiza guia de contexto e regras do projeto`                |
| Mudança de configuração | `chore: atualiza CORE_PORT de 3001 para 80`                          |

---

## 2. Contexto do Projeto Atual

### Stack e Arquitetura

- **Monorepo** com dois apps principais: `chat-core` (backend NestJS/TypeScript) e `chat-omnia` (frontend React)
- **Banco de Dados**: PostgreSQL 16 com pgvector, gerenciado por Docker Swarm
- **Infraestrutura**: Docker Swarm (Portainer), registry privado `registry.cloud.grupopw2c.com.br`
- **API Gateway**: Nginx (proxy para o Backend na porta 80)
- **IA**: Provider `echo` para testes, NVIDIA NIM para produção

### Arquivos Modificados Recentemente

| Arquivo                              | Tipo de alteração | Descrição                                                                                 |
| ------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------- |
| `apps/chat-core/src/index.ts`        | Código            | Adição de rotas `/health`, `/health/ready`, `/health/live`; mudança de porta 3001 para 80 |
| `apps/docker/nginx.conf`             | Configuração      | Atualização do upstream de `core:3001` para `core:80` em 2 locations                      |
| `apps/docker/pw2c/docker-stack.yml`  | Configuração      | `CORE_PORT` mudou de `'3001'` para `'80'`                                                 |
| `apps/chat-core/tsconfig.json`       | Configuração      | Adição de `"types": ["node"]`                                                             |
| `apps/chat-core/tsconfig.test.json`  | Configuração      | Adição de `"types": ["node"]`                                                             |
| `apps/chat-core/tsconfig.json`       | Configuração      | Adição de `"types": ["node"]`                                                             |
| `docs/backend/health-check-backend.md`     | Nova documentação | Documentação das rotas de health check do Backend                                            |
| `docs/backend/fluxo-git-e-contexto.md`  | Nova documentação | Este arquivo - fluxo de git e contexto do projeto                                         |
| `apps/docker/pw2c/.env`              | Novo arquivo      | Variáveis de ambiente da stack PW2C                                                       |
| `apps/docker/pw2c/stack.env.example` | Removido          | Template removido conforme solicitação                                                    |

### Variáveis de Ambiente Críticas (no Portainer)

| Variável            | Valor Obrigatório                                  | Local                                     |
| ------------------- | -------------------------------------------------- | ----------------------------------------- |
| `POSTGRES_PASSWORD` | `omniabanco2026`                                   | Stacks → omnia → Environment variables    |
| `POSTGRES_USER`     | `omnia_user`                                       | Igual no Portainer e no .env              |
| `POSTGRES_DB`       | `omnia`                                            | Igual em ambos os lugares                 |
| `OMNIA_CORE_IMAGE`  | `registry.cloud.grupopw2c.com.br/chat-core:latest` | Portainer e .env                          |
| `OMNIA_WEB_IMAGE`   | `registry.cloud.grupopw2c.com.br/chat-web:latest`  | Portainer e .env                          |
| `AI_PROVIDER`       | `echo`                                             | Padrão para testes sem cota da NVIDIA     |
| `CORE_PORT`         | `80`                                               | Deve ser `80` no Portainer e no yaml      |
| `NVIDIA_MODEL`      | `meta/llama-3.3-70b-instruct`                      | Para quando mudar de provider para NVIDIA |

---

## 3. Passo a Passo para Commit e Push (Fluxo Completo)

### Passo 1: Mudar para a branch develop e atualizar

```bash
git checkout develop
git pull origin develop
```

### Passo 2: Criar a branch da tarefa

```bash
git checkout -b feat/health-check-core-contexto
```

### Passo 3: Adicionar os arquivos (incluindo o novo markdown)

```bash
git add .
# Isto adicionará:
# - Modified files (códigos, configs, yamls)
# - Novo markdown: docs/backend/fluxo-git-e-contexto.md
# - Novo arquivo: apps/docker/pw2c/.env
# - Removido: apps/docker/pw2c/stack.env.example
```

### Passo 4: Commit com mensagem padrão

```bash
git commit -m "feat: adiciona guia de fluxo de git e contexto do projeto

- Cria docs/backend/fluxo-git-e-contexto.md com regras de commit,
  fluxo git, contexto do projeto e variáveis críticas
- Atualiza códigos e configs conforme trabalho realizado
- Remove stack.env.example desnecessário
- Prepara ambiente para funcionalidade de health check no Core"
```

### Passo 5: Push para o remote

```bash
git push -u itia feat/health-check-core-contexto
```

### Passo 6: (Opcional) Abrir PR

Após o push, abrir Pull Request no GitHub:

```
https://github.com/healthdevio/projeto-itia-dois/pull/new/feat/health-check-core-contexto
develop
```

---

## 4. Atalhos Úteis no Portainer

| Ação                 | Caminho no Portainer                            |
| -------------------- | ----------------------------------------------- |
| Reiniciar stack      | Stacks → omnia → Botão "Update the stack"       |
| Repull image         | Mesmo local → Botão "Repull image"              |
| Ver logs da task     | Stacks → omnia → omnia_core → Tasks → View Logs |
| Ver variáveis de env | Stacks → omnia → Environment variables          |
| Ver status da task   | Stacks → omnia → omnia_core → Tasks             |

---

## 5. Checklist Pré-Deploy (Antes de Merge para Main)

- [ ] Container backend está `Running` (não `starting → complete`)
- [ ] `https://projeto-itia-dois.cloud.grupopw2c.com.br/health` retorna `{"status":"ok",...}`
- [ ] `POSTGRES_PASSWORD` = `omniabanco2026` no Portainer
- [ ] `CORE_PORT` = `80` no Portainer e no yaml
- [ ] Constraint `node.hostname == compute01` no backend está ativo
- [ ] As 6 secrets do GitHub estão configurados (2 registry + 4 Portainer)
- [ ] Nó `compute01` está `Ready` em `docker node ls`

---

## 6. Solução de Problemas Rápida

| Sintoma                         | Provável Causa                                       | Solução                                                 |
| ------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| Container `starting → complete` | Variáveis de env inconsistentes                      | Verificar POSTGRES_PASSWORD, POSTGRES_USER no Portainer |
| `502 Bad Gateway`               | Nginx não proxyando corretamente                     | Reiniciar stack + Repull image                          |
| Health check `starting` parado  | Docker checkando `/health` antes do app estar pronto | Aguardar 2-3 minutos após o container ficar `Running`   |
| Código não sobe para o backend     | Branch errada ou yaml com erro                       | Verificar `git push -u itia feat/nome` e yaml syntax    |

---

## 7. Referências Rápidas

| Recurso          | Link/Location                                             |
| ---------------- | --------------------------------------------------------- |
| Repositório      | `https://github.com/healthdevio/projeto-itia-dois`        |
| Registry         | `registry.cloud.grupopw2c.com.br`                         |
| Portainer        | `https://portainer.empresa.com.br`                        |
| Domínio Produção | `https://projeto-itia-dois.cloud.grupopw2c.com.br`        |
| Health Check     | `https://projeto-itia-dois.cloud.grupopw2c.com.br/health` |

---

**Última atualização:** 2026-10-21  
**Versão:** 1.0  
**Mantido por:** Equipe Chat Omnia
 
 # #   V e r s � o :   1 . 1 
 
 
