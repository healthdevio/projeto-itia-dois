# Documentação da Interface — Chat Omnia

Esta pasta reúne a documentação da camada de Interface do Chat Omnia. O projeto é um chatbot de suporte cuja interface permite abrir o chat, alternar entre visualização compacta e expandida, apresentar mensagens e estados visuais e, em evolução, oferecer sugestões e histórico de conversas.

## Como navegar

Os documentos de componentes usam o mesmo nome do arquivo React correspondente (`.tsx`), conforme a convenção adotada para facilitar a localização da documentação.

### Componentes de chat
- [`FloatingChatButton.md`](FloatingChatButton.md) — botão flutuante que abre ou fecha a interface.
- [`MiniChat.md`](MiniChat.md) — visualização compacta do chat.
- [`ExpandedChat.md`](ExpandedChat.md) — visualização expandida.
- [`ChatHeader.md`](ChatHeader.md) — cabeçalho reutilizado nas visualizações do chat.

### Mensagens e entrada
- [`MessageItem.md`](MessageItem.md) — apresentação de uma mensagem individual.
- [`MessageList.md`](MessageList.md) — apresentação da lista de mensagens.
- [`ChatInput.md`](ChatInput.md) — entrada de texto e ação de envio.

### Estados visuais
- [`ChatStateView.md`](ChatStateView.md) — apresentação dos estados visuais da interface.
- [`LoadingIndicator.md`](LoadingIndicator.md) — indicador visual de carregamento.

### Sugestões e histórico
- [`SuggestionList.md`](SuggestionList.md) — apresentação e seleção de sugestões.
- [`HistoryPanel.md`](HistoryPanel.md) — área de apresentação do histórico.
- [`HistoryItem.md`](HistoryItem.md) — item individual do histórico.

### Aplicação e arquitetura
- [`App.md`](App.md) — coordenação da interface e estado compartilhado.
- [`configuracao_ambiente.md`](configuracao_ambiente.md) — configuração do ambiente de desenvolvimento.
- [`estrutura_componentes.md`](estrutura_componentes.md) — organização das pastas e responsabilidades.

## Status e precisão

A documentação distingue o que está registrado nas tasks anteriores do que ainda precisa ser confirmado no código atual. Em particular, a Task P1-T08 — sugestões e histórico — permanece **WIP / em andamento**, não concluída nem integrada à `develop`, conforme o registro fornecido.

As descrições de props e detalhes de implementação devem ser conferidas nos arquivos `.tsx` atuais antes de serem tratadas como contratos definitivos. Não se deve presumir que uma descrição histórica continua exatamente igual após refatorações.

## Validações recomendadas

Antes de integrar alterações na documentação:

1. Conferir os nomes e caminhos reais dos componentes.
2. Conferir cada descrição de props e comportamento contra o código atual.
3. Atualizar links internos se arquivos forem renomeados.
4. Executar `git diff --check`.
5. Revisar `git diff` antes de criar o commit.
6. Quando houver alterações de código relacionadas, executar os comandos de validação definidos pelo projeto, como typecheck/build e testes aplicáveis.