# Modelo de ChatContext

Esse documento descreve a estrutura `ChatContext`, que poderá reunir informações adicionais sobre o contexto em que a Omnia IA está sendo utilizada.

## O que é o ChatContext?

O `ChatContext` é uma estrutura de dados preparada para transportar informações sobre o usuário, seu perfil, suas preferências, a sessão atual e o ambiente em que o chat está sendo utilizado.

A estrutura foi criada para permitir que futuras integrações forneçam essas informações sem exigir que todos os campos estejam presentes desde o início.

O modelo define apenas o formato dos dados. Ele não busca informações do usuário, não acessa o Host e não envia o contexto para o provider da IA.

## Campos

| Campo            | Tipo                      | Descrição                                                            |
| ---------------- | ------------------------- | -------------------------------------------------------------------- |
| `user`           | `Record<string, unknown>` | Informações relacionadas ao usuário.                                 |
| `profile`        | `Record<string, unknown>` | Dados complementares sobre o perfil do usuário.                      |
| `preferences`    | `ChatConfig`              | Preferências de atendimento, como idioma, tom e tamanho da resposta. |
| `session`        | `Record<string, unknown>` | Informações relacionadas à sessão atual.                             |
| `current_page`   | `string`                  | Página ou área atual em que o chat está sendo utilizado.             |
| `permissions`    | `string[]`                | Lista de permissões disponíveis no contexto.                         |
| `system_context` | `string`                  | Informações adicionais sobre o contexto do sistema.                  |

Todos os campos são opcionais. Isso permite que o contexto seja construído gradualmente, conforme as informações estiverem disponíveis.

## Relação com ChatConfig

O campo `preferences` reutiliza o modelo `ChatConfig`, documentado em [ChatConfig.md](./ChatConfig.md).

O `ChatConfig` representa as opções de atendimento enviadas pela interface em uma mensagem. O `ChatContext` permite que essas preferências façam parte de uma estrutura mais ampla de contexto.

## Implementação

O modelo está definido em:

`apps/chat-back/src/models/chat-context.ts`

A estrutura utiliza `ChatConfig` por meio de uma importação de tipo. Os campos que recebem objetos flexíveis utilizam `Record<string, unknown>`, evitando o uso de `any`.

## Escopo atual

O `ChatContext` está definido como modelo de dados. Sua criação não altera o contexto operacional `AIContext`, utilizado atualmente pelo Core para montar o histórico enviado ao provider da IA.

A estrutura ainda não está integrada ao fluxo de mensagens, à autenticação, à sessão ou a uma integração com Host. Esses usos dependem de implementação posterior.

## Task relacionada

**Task 07 — Criar o ChatContext**

Resultado: estrutura de contexto definida e preparada para futuras utilizações pela Omnia IA e integrações.
