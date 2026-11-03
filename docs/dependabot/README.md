# Dependabot: funcionamento geral

O Dependabot é um serviço do GitHub que acompanha dependências de um repositório e pode propor atualizações por meio de pull requests. Ele ajuda a manter bibliotecas, imagens de contêiner e GitHub Actions atualizadas. A automação não substitui a revisão: uma atualização pode mudar comportamento, exigir ajustes ou revelar incompatibilidades.

Este guia explica o fluxo geral e como ele está configurado neste repositório.

## O que ele faz

O Dependabot identifica arquivos de dependências compatíveis com o ecossistema configurado, consulta versões disponíveis e compara essas versões com as declaradas no projeto. Quando encontra uma atualização que se enquadra nas regras da configuração, pode abrir um pull request com a alteração proposta.

Em geral, cada pull request informa a dependência alterada, a versão anterior e a nova, e apresenta dados de versão e vulnerabilidades quando disponíveis. O GitHub também pode executar os checks normais do repositório no pull request. Esses checks são definidos pelos workflows do projeto; não são testes inventados ou executados pelo Dependabot por conta própria.

## O que ele não faz

- Não garante que a nova versão seja compatível com o código.
- Não faz merge automaticamente por padrão.
- Não substitui CI, revisão de código, testes ou política de releases.
- Não corrige automaticamente problemas funcionais introduzidos por uma atualização.
- Não atualiza componentes que não estejam cobertos por um ecossistema e diretório reconhecidos.

Um pull request aprovado ainda precisa passar pelas regras de proteção e pelo processo de integração configurado no repositório.

## Configuração no repositório

A configuração fica em [`.github/dependabot.yml`](../../.github/dependabot.yml). O arquivo declara `version: 2`, formato de configuração usado pelo Dependabot, e seis grupos de monitoramento:

| Ecossistema      | Diretório                  | O que acompanha                                                                    |
| ---------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| `npm`            | `/`                        | Dependências npm declaradas na raiz do repositório.                                |
| `npm`            | `/apps/chat-back`          | Dependências npm do backend.                                                       |
| `npm`            | `/apps/chat-omnia`         | Dependências npm do frontend.                                                      |
| `npm`            | `/apps/packages/knowledge` | Dependências npm do pacote knowledge.                                              |
| `docker`         | `/apps/docker`             | Referências a imagens Docker declaradas nos arquivos reconhecidos nesse diretório. |
| `github-actions` | `/`                        | Versões de Actions referenciadas nos workflows do GitHub Actions.                  |

Cada grupo está agendado para `monthly`, na segunda-feira. O agendamento informa quando o Dependabot pode procurar atualizações. Não significa que todos os pull requests serão necessariamente criados exatamente nesse horário: limites de pull requests, falhas de análise e outras condições do GitHub podem afetar o processamento.

As entradas npm são separadas por diretório porque cada aplicação ou pacote pode ter seu próprio manifesto e arquivo de lock. A entrada na raiz cobre os arquivos npm existentes na raiz, enquanto cada entrada de subdiretório cobre os manifestos encontrados naquele caminho. Para o Docker, o diretório deve conter arquivos que o Dependabot consiga analisar, como Dockerfiles ou arquivos de configuração compatíveis. A entrada `github-actions` examina os workflows em `.github/workflows`, embora sua raiz de busca seja `/`.

## Ciclo de uma atualização

1. **Leitura da configuração:** o GitHub lê `.github/dependabot.yml` na branch padrão do repositório. Erros de sintaxe ou valores incompatíveis podem impedir a execução; consulte os alertas de configuração no GitHub.
2. **Agendamento:** o serviço verifica cada combinação de ecossistema e diretório de acordo com seu intervalo configurado.
3. **Descoberta:** ele analisa manifestos, arquivos de lock, Dockerfiles ou referências a Actions, conforme o ecossistema.
4. **Comparação:** compara as versões declaradas com as versões disponíveis e determina atualizações permitidas.
5. **Pull request:** se houver uma atualização aplicável, o Dependabot propõe a mudança em um pull request. Atualizações relacionadas podem, dependendo do ecossistema e das opções, ser agrupadas.
6. **Validação do projeto:** os workflows de CI configurados podem rodar no pull request. A equipe revisa mudanças, resultados dos checks e impactos.
7. **Integração:** depois da aprovação e dos checks exigidos, o pull request pode ser integrado pelo fluxo normal do projeto.

O Dependabot pode atualizar tanto o manifesto quanto o arquivo de lock, quando aplicável. O arquivo de lock fixa as versões resolvidas e deve ser revisado junto com o manifesto.

## Tipos de atualização de dependências

Para dependências versionadas segundo SemVer, as atualizações são normalmente classificadas como:

- **Major:** muda o primeiro número da versão, por exemplo `2.x` para `3.x`. Pode conter mudanças incompatíveis.
- **Minor:** muda o número intermediário, por exemplo `2.4` para `2.5`. Costuma acrescentar funcionalidades mantendo compatibilidade declarada.
- **Patch:** muda o último número, por exemplo `2.4.1` para `2.4.2`. Costuma incluir correções compatíveis.

Essa classificação é uma convenção da versão publicada, não uma garantia de que o código ficará compatível. Nem todo projeto usa SemVer corretamente.

## Atualizações de segurança e atualizações de versão

São fluxos relacionados, mas distintos:

- **Atualizações de versão** seguem o agendamento definido em `dependabot.yml` e procuram versões mais novas das dependências monitoradas.
- **Atualizações de segurança** respondem a alertas de vulnerabilidade para dependências afetadas. Elas dependem dos recursos de segurança do GitHub habilitados para o repositório e podem gerar pull requests corretivos fora do ciclo mensal.

Portanto, o agendamento mensal deste arquivo não deve ser interpretado como garantia de que alertas de segurança só serão tratados mensalmente. A disponibilidade de cada recurso depende das configurações do repositório e do GitHub.

## Revisão recomendada de um pull request

Ao revisar uma atualização, confira:

1. Se o pacote e o diretório alterados correspondem ao escopo esperado.
2. O changelog, notas de release e possíveis alterações incompatíveis entre as versões.
3. As mudanças no manifesto e no lockfile; verifique se alterações transitivas inesperadas fazem sentido.
4. Os checks de CI, incluindo testes e build. Um check verde reduz riscos, mas não prova ausência de regressões.
5. Se a mudança trata uma vulnerabilidade ou se é apenas uma atualização normal de versão.
6. Se a aplicação precisa de ajustes, configuração adicional ou validação manual antes do deploy.

Se o pull request falhar, investigue a mensagem do check e a mudança de versão. É possível solicitar uma versão mais recente, ajustar a dependência manualmente ou fechar o pull request quando a atualização não puder ser adotada. Fechar sem outras ações pode fazer com que a proposta reapareça em verificações futuras.

## Controles e personalização

O arquivo pode ser ampliado com opções por grupo, por exemplo para limitar pull requests abertos, definir dia e horário, ignorar versões específicas, permitir ou bloquear determinadas atualizações, agrupar dependências ou adicionar revisores e etiquetas. Essas opções devem ser configuradas de acordo com a política do projeto e a sintaxe aceita pelo ecossistema.

Antes de alterar o agendamento ou o escopo, considere o volume de pull requests e a capacidade da equipe para revisá-los. Mudanças em `dependabot.yml` são alterações de configuração do repositório e devem passar pelos checks e revisão habituais.

## Onde acompanhar

Os pull requests do Dependabot aparecem na lista de pull requests do repositório e podem ser filtrados pelo autor `dependabot[bot]`. Alertas de segurança e a configuração dos recursos de segurança aparecem nas áreas **Security** e **Settings** do repositório, conforme permissões e recursos disponíveis no plano do GitHub.

Para mudar os ecossistemas, diretórios ou frequências monitoradas neste projeto, edite [`.github/dependabot.yml`](../../.github/dependabot.yml). Para entender os checks e o fluxo de integração, consulte a [documentação de CI/CD](../ci_cd/README.md).
