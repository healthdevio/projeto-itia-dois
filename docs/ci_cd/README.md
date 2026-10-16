# CI/CD

Como o projeto chega do `git push` até a aplicação rodando no cluster Docker
Swarm da PW2C, e o que precisa estar pronto para isso acontecer.

| Documento                                         | Assunto                                                    |
| ------------------------------------------------- | ---------------------------------------------------------- |
| [visao-geral.md](visao-geral.md)                  | As três etapas e o diagrama do caminho completo            |
| [decisoes.md](decisoes.md)                        | **Por que cada chose assim.** Sem comentários nos arquivos |
| [troca-de-servidor/](troca-de-servidor/README.md) | Como o deploy saiu da Oracle e veio para o cluster         |
| [pre-requisitos.md](pre-requisitos.md)            | O que precisa existir antes do primeiro deploy             |
| [publicacao.md](publicacao.md)                    | Construção e publicação das imagens                        |
| [deploy.md](deploy.md)                            | O que acontece no cluster, serviço por serviço             |
| [operacao.md](operacao.md)                        | Verificar, diagnosticar e reverter                         |
| [problemas/](problemas/README.md)                 | **Diagnóstico.** Por sintoma, causa e resolução            |

## As três etapas

```
1. BUILD     código  →  imagem
2. PUBLISH   imagem  →  registry
3. DEPLOY    registry →  cluster rodando
```

Separar as três é o que torna o problema diagnosticável. Se o build passou mas o
`pull` dá `manifest unknown`, o problema é a etapa 2. Se o `pull` funcionou e a
aplicação não mudou, é a 3.

## Onde cada etapa mora

| Etapa   | Onde                                              |
| ------- | ------------------------------------------------- |
| Build   | `apps/docker/Dockerfile.core`, `Dockerfile.web`   |
| Publish | `.github/workflows/cd.yml`, job `build`           |
| Deploy  | job `build-and-deploy`, etapa `Atualizar a stack` |

## Onde cada coisa mora

```
registry.cloud.grupopw2c.com.br     registry privado da empresa
chat-core                           API, migrations e a configuração de AI
chat-web                            nginx que serve a interface e faz proxy /api
stack "omnia"                       Postgres + Core + web, no Swarm
```

## A ordem dos ambientes

```
develop ──> build e publica
main    ──> build, publica e atualiza a stack
```

O `cd.yml` dispara em ambas as branches. Em `develop`, publica as
imagens com a tag `develop`. Em `main`, publica e redeploya a stack.

## O que difere de um compose comum

O cluster é **Swarm**, não `docker compose`. Três consequências:

- `depends_on` não funciona. Quem espera por quem é o `entrypoint.sh` do Core.
- Todo serviço é perpétuo. Não existe container de migration que sai; a migration
  roda dentro do Core antes do servidor HTTP.
- O Postgres fica preso ao `compute01`. O volume é local, e um banco que muda de
  nó sobe vazio.

Ver [deploy.md](deploy.md) para o detalhe de cada uma.

## Estado

O cluster da PW2C ainda não foi provisionado. O deploy está escrito e revisado,
mas nunca rodou — diferente da homologação anterior na VM, que validou o
caminho nginx → Core → Postgres.

O que falta está em [pre-requisitos.md](pre-requisitos.md).
