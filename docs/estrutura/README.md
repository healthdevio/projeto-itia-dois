# Estrutura

Documentação do repositório.

## CI/CD

| Pasta                               | Conteúdo                                               |
| ----------------------------------- | ------------------------------------------------------ |
| [`docs/ci_cd/`](../ci_cd/README.md) | **Comece aqui.** Pipeline completa, do push ao cluster |

O `docs/ci_cd/` reúne o processo de entrega em um lugar só: o que precisa existir
antes, como a imagem é publicada, o que acontece no cluster, e como verificar ou
reverter.

## Conteúdo desta pasta

| Documento                                              | Assunto                                      |
| ------------------------------------------------------ | -------------------------------------------- |
| [ci.md](ci.md)                                         | Os 4 jobs da CI e o que cada um valida       |
| [docker.md](docker.md)                                 | As imagens, a stack e o nginx                |
| [ambientes.md](ambientes.md)                           | Dev local, stack e senhas                    |
| [config_github.md](config_github.md)                   | Secrets do registry e do Portainer no GitHub |
| [testes.md](testes.md)                                 | A suíte do Core: o que cobre e o que não     |
| [fluxo_de_versionamento.md](fluxo_de_versionamento.md) | Branch, PR, revisão, promoção                |

## Modelo do Core

| Documento                                          | Assunto                            |
| -------------------------------------------------- | ---------------------------------- |
| [../core/Conversation.md](../core/Conversation.md) | Conversa, estados e contexto       |
| [../core/Message.md](../core/Message.md)           | Modelo e endpoint de envio         |
| [../core/Suggestion.md](../core/Suggestion.md)     | Sugestões, endpoints e limites     |
| [../core/ChatConfig.md](../core/ChatConfig.md)     | Configuração e o repasse para a AI |

## Divisão

```
docs/
├── ci_cd/        o processo de entrega, do push ao deploy
├── core/         o contrato do Core, para quem consome a API
└── estrutura/    as peças que sustentam o processo
```

A regra: **o que alguém precisa saber para fazer algo pertence ao processo de
entrega** (`ci_cd/`); **o que descreve uma peça isolada fica em `estrutura/`**.

Assim o `entrypoint.sh` é descrito em `ci_cd/deploy.md`, e não em
`estrutura/docker.md` — porque ele existe para o deploy rodar, não para descrever
a imagem.
