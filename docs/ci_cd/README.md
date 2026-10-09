# CI/CD

Como o projeto chega do `git push` até a aplicação rodando numa VM, e o que
precisa estar pronto para isso acontecer.

| Documento                              | Assunto                                         |
| -------------------------------------- | ----------------------------------------------- |
| [visao-geral.md](visao-geral.md)       | As três etapas e o diagrama do caminho completo |
| [pre-requisitos.md](pre-requisitos.md) | O que precisa existir antes do primeiro deploy  |
| [publicacao.md](publicacao.md)         | Construção e publicação das imagens             |
| [deploy.md](deploy.md)                 | O que acontece na VM, serviço por serviço       |
| [operacao.md](operacao.md)             | Verificar, diagnosticar e reverter              |
| [problemas/](problemas/README.md)      | **Diagnóstico.** Por sintoma, causa e resolução |

## As três etapas

```
1. BUILD     código  →  imagem
2. PUBLISH   imagem  →  registry
3. DEPLOY    registry →  servidor rodando
```

Separar as três é o que torna o problema diagnosticável. Se o build passou mas o
`pull` dá `manifest unknown`, o problema é a etapa 2. Se o `pull` funcionou e a
aplicação não mudou, é a 3.

## Onde cada etapa mora

| Etapa   | Onde                                            |
| ------- | ----------------------------------------------- |
| Build   | `apps/docker/Dockerfile.core`, `Dockerfile.web` |
| Publish | `.github/workflows/cd.yml`, job `build`         |
| Deploy  | job `deploy-homolog` / `deploy-prod`            |

## A ordem dos ambientes

```
develop ──> homologação  (/srv/omnia/homolog,  porta 8080)
main    ──> produção     (/srv/omnia/prod,     porta 80)
```

A `main` é a branch padrão do repositório, e é por isso que o `cd.yml` precisa
estar lá: `workflow_run` e `workflow_dispatch` só enxergam workflows presentes
na branch padrão.

## Estado

Homologação no ar desde 8 de outubro de 2026, com banco, API e interface
funcionando. Produção ainda não promovida.

O que falta está em [pre-requisitos.md](pre-requisitos.md), na seção
"Antes de produção".
