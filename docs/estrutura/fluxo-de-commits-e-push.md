# Fluxo de branch, commit e push

Este documento registra o fluxo usado neste repositório para preparar uma
alteração, enviá-la ao GitHub e abrir um Pull Request.

## Criar uma branch de tarefa

Comece atualizando `develop` e crie uma branch própria para a tarefa:

```bash
git checkout develop
git pull itia develop
git checkout -b feat/nome-da-tarefa
```

Use o remoto `itia`, conforme o fluxo do projeto. Escolha um nome curto que
descreva o trabalho, por exemplo `feat/fix-chat-back-ci`.

## Registrar as alterações

Antes de adicionar os arquivos, confira o que mudou:

```bash
git status --short
```

Adicione e faça o commit seguindo o padrão de mensagem da equipe:

```bash
git add .
git commit -m "fix: descreve a correção"
```

Prefixos comuns são `feat:` para funcionalidade, `fix:` para correção e
`docs:` para documentação. Se o repositório tiver alterações de outras tarefas,
adicione apenas os arquivos que pertencem a este commit em vez de usar `git add .`.

## Enviar a branch e abrir o PR

```bash
git push -u itia feat/nome-da-tarefa
gh pr create --base develop --head feat/nome-da-tarefa
```

O PR de uma tarefa deve apontar para `develop`. Depois do primeiro push, as
correções seguintes são feitas na mesma branch e enviadas com `git push`; o PR
existente é atualizado automaticamente.

## Fluxo depois da integração

1. O CI valida a branch do PR.
2. Após revisão e aprovação, integre o PR em `develop`.
3. Para promover `develop` a produção, abra um PR separado com base `main`.
4. O CI roda novamente no PR para `main`.

## Consultar o CI pelo GitHub CLI

Depois de instalar e autenticar o CLI, estes comandos mostram PRs, checks e
execuções recentes:

```bash
gh auth status
gh pr list --state open
gh pr checks NUMERO_DO_PR
gh run list --branch nome-da-branch
```

No Windows, se o terminal ainda não reconhecer `gh` logo após a instalação pelo
`winget`, abra um PowerShell novo ou use:

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' auth login
```

Conclua a autorização em `https://github.com/login/device` quando o CLI mostrar
um código. Não compartilhe tokens ou senhas no chat.
