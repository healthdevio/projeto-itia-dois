# Troca de servidor

Como o deploy saiu da VM do Oracle Cloud e passou para o cluster Docker Swarm da
PW2C, e o que cada decisão do desenho novo resolve.

| Documento                     | Assunto                                     |
| ----------------------------- | ------------------------------------------- |
| [README.md](README.md)        | O problema da Oracle, o impacto e a decisão |
| [migracao.md](migracao.md)    | Mudança por mudança, com o antes e o depois |
| [decisoes.md](../decisoes.md) | Por que cada chose assim                    |

---

## O essencial

**O servidor trocou. O código, o banco e o processo não.**

O que mudou por completo foi o **destino** do deploy e o **modelo de
infraestrutura**: de `docker compose` numa VM para Docker Swarm num cluster, com
atualização pela API do Portainer em vez de SSH.

---

## Resumo em uma tela

|                   | Antes                           | Agora                             |
| ----------------- | ------------------------------- | --------------------------------- |
| Servidor          | Oracle Cloud (VM única)         | Cluster Swarm da PW2C             |
| Topologia         | `docker compose`                | `docker stack`                    |
| Registry          | `ghcr.io`                       | `registry.cloud.grupopw2c.com.br` |
| Entrada do deploy | SSH + `scp` + script            | API do Portainer com token        |
| Trigger           | `workflow_run` após a CI        | `push` direto                     |
| Postgres          | container à parte, rede externa | **serviço da stack**              |
| Rede              | `omnia-db`, criada à mão        | `omnia_net` overlay do Swarm      |
| Senha do banco    | `.env` na VM                    | `.Env` da stack                   |
| Migrations        | serviço `migrate-core`          | dentro do `entrypoint.sh`         |
| Imagem do banco   | fora do repositório             | `pgvector/pgvector:pg16`          |
| Portainer         | —                               | **Community Edition**             |
| Fixidez do banco  | implícita (uma VM)              | constraint no `compute01`         |

---

## Por que a Oracle não dava para continuar

A instância ficou presa em `Stopping` com o console reportando `Running`.
Nenhuma transição de estado respondia:

```
Unable to start instance: instance ocid1.instance... is currently being modified
```

Force stop, force reboot e hard refresh não alteraram nada. O audit log do
`computeApi` não registrava sequer a tentativa — o console se recusava a enviar o
comando à API.

O sintoma é de infraestrutura da Oracle, não do projeto: todas as portas fechadas
(inclusive a 22) eliminam regra de firewall, e o badge contraditório na própria
tela do console — `Running` com o botão `Start` — indicava estado em cache de um
lock órfão no plano de controle.

O caminho era esperar o suporte da Oracle ou migrar. A empresa ofereceu o cluster
com Docker Swarm, e a migração passou a ser o caminho.

Ver [`README.md`](README.md) para o relato completo.

---

## O que não mudou

|                 |                                                      |
| --------------- | ---------------------------------------------------- |
| Código-fonte    | nenhum arquivo de `apps/` foi alterado pela migração |
| Schema do banco | `conversations`, `messages`, `suggestions`           |
| Contrato da API | rotas, header `X-User-Id`, formato de resposta       |
| Validação       | os 4 jobs da CI, os 95 testes do Backend             |
| Fluxo de branch | `develop` recebe PR, `main` recebe promoção          |

A migração é de infraestrutura. O `Dockerfile.core` ganhou o `entrypoint.sh` como
entrada — necessário para o Swarm — e nada mais nesse arquivo mudou.

---

## As quatro diferenças que exigiram decisão

### 1. `depends_on` não funciona no Swarm

O compose orquestra serviços. O Swarm não: distribui containers e **ignora**
`depends_on`.

O modelo antigo dependia disso:

```yaml
core:
  depends_on:
    migrate-core:
      condition: service_completed_successfully
```

No Swarm, essa espera nunca aconteceria — e o Backend subiria antes da migration.

**Solução:** o `entrypoint.sh` assume a ordenação. Ver
[decisoes.md](../decisoes.md#a-migration-dentro-do-backend).

### 2. Todo serviço do Swarm é perpétuo

No compose, um container pode terminar. No Swarm, não — um serviço que termina
simplesmente é recriado.

O modelo antigo usava essa capacidade: `migrate-core` rodava, aplicava, saía.
Copiado para o Swarm, viraria um laço de migrations.

**Solução:** a mesma. Migration dentro do Backend, antes do servidor HTTP.

### 3. O Postgres era gerenciado por fora

Na VM, o banco vivia num container separado, conectado por `--alias` numa rede
externa criada à mão. O compose do deploy não tinha serviço `postgres` — por
construção, para não subir um banco novo e vazio.

No cluster, essa separação não faz sentido: a stack pode ser dona do banco.

**Consequência:** o problema `getaddrinfo ENOTFOUND postgres` **deixa de
existir**. Não há mais rede externa para conectar à mão.

### 4. Webhook de stack é Business Edition

O arquivo de referência da empresa usava `PORTAINER_WEBHOOK_URL`. O Portainer
deles é **Community Edition**, onde esse webhook não existe: o botão não aparece
na tela e `POST /api/stacks/webhooks/{id}` devolve `404`.

**Solução:** a API com token de acesso, que existe nas duas edições. Custo: quatro
secrets em vez de um.

---

## Documentos relacionados

| Documento                                        | Assunto                     |
| ------------------------------------------------ | --------------------------- |
| [migracao.md](migracao.md)                       | mudança por mudança         |
| [decisoes.md](../decisoes.md)                    | por que cada chose assim    |
| [../pre-requisitos.md](../pre-requisitos.md)     | o que configurar no cluster |
| [../problemas/README.md](../problemas/README.md) | diagnóstico por sintoma     |
