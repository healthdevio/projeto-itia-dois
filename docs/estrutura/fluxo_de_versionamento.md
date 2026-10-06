# Fluxo de Versionamento

## Objetivo

Definir um fluxo de versionamento para o projeto Chat Omnia, estabelecendo um padrão para criação de tasks, desenvolvimento, commits, Pull Requests, revisão de código, integração e disponibilização das versões.

## Implementação

Foi definido um fluxo de desenvolvimento baseado na utilização de branches específicas para cada task, Pull Requests e integração progressiva entre as branches `develop` e `main`.

O fluxo inicia com a criação da task, definição de seu ID e responsável. Em seguida, é criada uma branch específica para o desenvolvimento da task.

Durante o desenvolvimento, as alterações devem ser registradas por meio de commits seguindo o padrão definido pela equipe.

Após a conclusão, a branch deve ser enviada para o GitHub e utilizada para a criação de um Pull Request direcionado à branch `develop`.

## Integração e Validação

Após a criação do Pull Request, o GitHub Actions executará automaticamente as validações de CI configuradas no projeto, incluindo testes, lint, TypeScript e build.

O código deverá ser revisado por outro integrante da equipe.

Caso sejam encontrados problemas durante o CI ou na revisão, as correções deverão ser realizadas na mesma branch e enviadas novamente para o Pull Request.

Após a aprovação e conclusão das validações, o Pull Request poderá ser integrado à branch `develop`.

## Homologação

O código integrado à `develop` será disponibilizado no ambiente de homologação para realização dos testes e validações da aplicação.

Caso sejam identificados problemas durante a homologação, será necessário retornar ao desenvolvimento, realizar as correções e repetir o processo de validação.

## Publicação

Após a validação da versão em homologação, será criado um Pull Request da branch `develop` para a branch `main`.

O GitHub Actions realizará novamente as validações de CI/CD antes da integração.

Após a aprovação, o Pull Request será integrado à `main`, que representará a versão estável e aprovada do projeto.

## Fluxo

```text
Task
 ↓
Branch da Task
 ↓
Desenvolvimento
 ↓
Commits
 ↓
Push
 ↓
Pull Request → develop
 ↓
CI
 ↓
Code Review
 ↓
Correções (se necessário)
 ↓
Merge → develop
 ↓
Homologação
 ↓
Validação
 ↓
Pull Request → main
 ↓
CI/CD
 ↓
Aprovação
 ↓
Merge → main
 ↓
Versão estável
```
