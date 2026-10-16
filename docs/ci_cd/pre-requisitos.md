# Pré-requisitos

O que precisa existir antes do primeiro deploy no cluster. Uma vez só, por
cluster.

## Checklist

```
[ ] O no compute01 confirmado no Swarm
[ ] Stack "omnia" criada no Portainer com o docker-stack.yml
[ ] .Env da stack preenchido no Portainer
[ ] OMNIA_CORE_IMAGE e OMNIA_WEB_IMAGE presentes no .Env
[ ] Token da API do Portainer criado
[ ] Secrets do GitHub configurados
```

## 1. O nó do banco

O Postgres usa um volume **local**, que não viaja entre servidores do Swarm. Se o
container mudar de nó, sobe lá um banco vazio, e o Core passa a conectar num
banco sem as tabelas.

A stack trava o Postgres no `compute01`:

```yaml
placement:
  constraints:
    - node.hostname == compute01
```

Confira se o nome confere:

```bash
docker node ls
```

Se a coluna `HOSTNAME` mostrar outro nome, ajuste a constraint **antes** de subir
a stack. Sem um nó que satisfaça a condição, o Postgres fica em `Pending` e os
outros serviços esperam por ele.

```mermaid
flowchart TB
    subgraph CLUSTER [cluster Swarm]
        N1[compute01<br/>Postgres + volume]
        N2[compute02<br/>Core]
        N3[compute03<br/>web]
    end
    C[core] --> P[(postgres<br/>no compute01)]
    W[web] --> C
```

## 2. A senha no `.Env`

A senha do Postgres é uma variável de ambiente da stack, não um `docker secret`.
O template está em
[`apps/docker/pw2c/stack.env.example`](../../apps/docker/pw2c/stack.env.example).

No stack, ela é exigida com `:?`:

```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?defina POSTGRES_PASSWORD no .Env da stack}
```

O `:?` faz o Swarm **recusar a stack** com mensagem explícita, em vez de subir um
banco com senha vazia. É a diferença entre um erro na hora do deploy e um banco
que aceita uma senha que ninguém sabe.

## 3. A stack no Portainer

Em **Stacks → Add stack → Web editor**, cole o conteúdo de
`apps/docker/pw2c/docker-stack.yml` e **deploy**.

O template das variáveis está em
[`apps/docker/pw2c/stack.env.example`](../../apps/docker/pw2c/stack.env.example).

## 4. O `.Env` da stack

As variáveis de ambiente da stack são editáveis em **Stacks → omnia → Environment
variables**. Não são o mesmo arquivo que o compose: é onde o Portainer guarda os
valores, e é de lá que o deploy lê.

| Variável            | Valor                  | Por quê                              |
| ------------------- | ---------------------- | ------------------------------------ |
| `OMNIA_CORE_IMAGE`  | `.../chat-core:latest` | **o deploy reescreve com a tag**     |
| `OMNIA_WEB_IMAGE`   | `.../chat-web:latest`  | idem                                 |
| `OMNIA_WEB_PORT`    | `8080`                 | porta de entrada                     |
| `POSTGRES_DB`       | `omnia`                | nome do banco                        |
| `POSTGRES_USER`     | `omnia_user`           | idem                                 |
| `POSTGRES_PASSWORD` | a senha do banco       | **tem que ser a que o banco aceita** |
| `AI_PROVIDER`       | `echo`                 | texto fixo, sem gastar cota          |
| `NVIDIA_API_KEY`    | vazio                  | só ao ativar `nvidia`                |
| `NVIDIA_*`          | —                      | demais da chave                      |

**`OMNIA_CORE_IMAGE` e `OMNIA_WEB_IMAGE` precisam existir.** O deploy só troca o
valor delas; se não existirem, a stack sobe com o `latest` do compose e todo
deploy publica imagem sem aplicar.

O Core se conecta por URL, e a URL monta a senha a partir do `.Env`:

```
postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
```

Nada é escrito à mão no stack — é interpolação do Swarm.

## 5. Token da API do Portainer

O Portainer é **Community Edition**, e webhook de stack é Business Edition. O
deploy usa a API, que existe nas duas edições.

Em **Account settings → Access tokens → Add access token**.

O token precisa de escopo de escrita em stacks. Cópie uma vez: não dá para
reexibir depois.

## 6. Secrets no GitHub

Em **Settings → Secrets and variables → Actions**.

| Secret                   | Valor                                  |
| ------------------------ | -------------------------------------- |
| `PW2C_REGISTRY_USERNAME` | usuário do registry da empresa         |
| `PW2C_REGISTRY_PASSWORD` | senha ou token do registry             |
| `PORTAINER_URL`          | `https://portainer.da.empresa.com.br`  |
| `PORTAINER_API_KEY`      | o token da seção 5                     |
| `PORTAINER_STACK_ID`     | id da stack "omnia"                    |
| `PORTAINER_ENDPOINT_ID`  | id do ambiente Swarm, quase sempre `1` |

Os dois últimos não são adivinháveis. O `STACK_ID` aparece na URL da tela da
stack (`#!/ stacks/1/...`), e o `ENDPOINT_ID` em **Home**.

## O primeiro deploy

```bash
git push origin main
```

Acompanhe em **Actions → CD (Continuous Delivery)**.

Confirme o resultado no cluster:

```bash
docker service ls --filter name=omnia_
```

Os três serviços precisam mostrar `1/1`. Um serviço em `0/1` ou `Pending`
aponta para constraint não satisfeita ou erro de configuração.

## Documentos relacionados

| Documento                      | Assunto                   |
| ------------------------------ | ------------------------- |
| [publicacao.md](publicacao.md) | build e publicação        |
| [deploy.md](deploy.md)         | o que acontece no cluster |
| [operacao.md](operacao.md)     | verificar e reverter      |
