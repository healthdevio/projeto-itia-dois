# FloatingChatButton

## Identificação

- **Task:** P1-T03
- **Nome da task:** Implementar o botão flutuante
- **Status registrado:** Concluída e integrada à `develop`
- **PR registrado:** #5
- **Commit registrado:** `7638cb8` — `feat: implementa botão flutuante do chat`
- **Branch histórica:** `feat/implementa-botao-flutuante`

## Objetivo

Criar o ponto de entrada visual do chatbot. O botão flutuante permite abrir e fechar a interface do chat.

## Responsabilidades

O registro da task informa que o componente recebe o estado `isOpen: boolean` e um callback `onClick: () => void`. Ele apresenta o estado visual, exibe o ícone adequado, dispara o evento de clique e fornece identificação acessível.

O botão não deve chamar APIs, executar `fetch`, consumir SSE, manipular mensagens, acessar o histórico nem conter regras de negócio da IA.

## Comportamento visual e acessibilidade

A implementação registrada utiliza ícones Lucide e classes Tailwind para posicionamento flutuante, formato circular, hover, foco, transições e estado aberto/fechado. O `aria-label` muda de acordo com o estado para distinguir abrir e fechar; também há foco visível para navegação por teclado.

## Fluxo registrado

```text
App
└── isOpen
    └── FloatingChatButton
        └── onClick()
```

O `App` controla o estado de abertura e o repassa ao botão.

## Validação registrada

- `npm run build`
- `npm run format`
- teste manual no navegador
- abertura e fechamento
- troca de ícone, hover e foco
- revisão das alterações e Pull Request

## Observação de manutenção

O componente deve continuar focado no controle visual e na interação de clique. A coordenação da janela pertence ao componente pai.

> Esta documentação resume o registro histórico da task. Confira as props e a implementação no `FloatingChatButton.tsx` atual antes de alterar o contrato.
