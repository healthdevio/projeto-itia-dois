# CI/CD

Índice da documentação de integração, publicação e operação do Chat Omnia.

## Estado atual

Os nomes de backend, serviço e imagem foram alinhados. A configuração ainda precisa passar pelo build da CI e validação no cluster antes de ser considerada operacional. O CD publica após CI aprovada, mas não atualiza a stack automaticamente.

Inconsistências confirmadas no repositório:

- `Dockerfile.core` compila `apps/chat-back`; o serviço Swarm e o upstream nginx usam `core`.
- O CD publica `chat-core`, nome configurado na stack.
- A CI agora executa `npm run format:check` sem alterar arquivos.
- O Postgres tem health check; a inicialização do backend também aguarda conexão antes das migrations.

## Documentos

| Documento                                           | Conteúdo                                                       |
| --------------------------------------------------- | -------------------------------------------------------------- |
| [Visão geral](visao-geral.md)                       | Gatilhos e etapas atuais dos workflows                         |
| [Decisões](decisoes.md)                             | Justificativas históricas da configuração de deploy            |
| [Pré-requisitos](pre-requisitos.md)                 | Configuração do cluster e credenciais                          |
| [Publicação](publicacao.md)                         | Build e publicação de imagens                                  |
| [Deploy](deploy.md)                                 | Modelo de stack previsto                                       |
| [Operação](operacao.md)                             | Verificação e diagnóstico; confira os nomes reais dos serviços |
| [Problemas](problemas/README.md)                    | Diagnóstico por sintomas                                       |
| [Migração de servidor](troca-de-servidor/README.md) | Registro histórico da migração da VM Oracle para Swarm         |

## Fluxo configurado

```text
PR/push para develop ou main -> CI
push para main -> CD: build e push das imagens
depois do CD -> atualização manual da stack no Portainer
```

O CD não depende explicitamente da conclusão da CI e não atualiza a stack. Alinhe isso com as regras de proteção de branches e com o processo de release desejado.
