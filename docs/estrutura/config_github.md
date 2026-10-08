# Configuração do GitHub

Passos manuais feitos uma vez no repositório. Não estão em código — vivem nas
settings do GitHub, e por isso não aparecem em nenhum `git log`.

Onde: `github.com/healthdevio/projeto-itia-dois` → **Settings**.

## Secrets do repositório

Em **Settings → Secrets and variables → Actions → New repository secret**.

| Secret           | Valor                                | Para quê           |
| ---------------- | ------------------------------------ | ------------------ |
| `DEPLOY_SSH_KEY` | conteúdo de `ssh-key-2026-09-22.key` | abrir sessão na VM |
| `DEPLOY_HOST`    | `167.126.20.64`                      | endereço da VM     |
| `DEPLOY_USER`    | `ubuntu`                             | usuário do SSH     |

O GitHub mostra só o nome, nunca o valor.

### Como colar a chave privada

O `Set-Clipboard` do PowerShell nem sempre existe. O caminho que funciona:

```powershell
notepad "C:\Users\Alec\Downloads\ssh-key-2026-09-22.key"
```

`Ctrl+A`, `Ctrl+C`, fecha **sem salvar** — salvar pelo Bloco de Notas troca LF por
CRLF, e o SSH recusa a chave.

No campo "Secret" do GitHub, cola com `Ctrl+V`. A primeira linha tem que ser
`-----BEGIN RSA PRIVATE KEY-----`, e o arquivo tem 27 linhas.

## Ambientes

Em **Settings → Environments**.

| Ambiente     | Proteção                              | Comportamento                 |
| ------------ | ------------------------------------- | ----------------------------- |
| `homolog`    | nenhuma                               | qualquer branch pode deployar |
| `production` | `Selected branches and tags` → `main` | só `main`                     |

O passo de proteção: **Configure production → Deployment branches and tags →
Selected branches and tags → digitar `main`**.

## Required reviewers não existe neste plano

A tela de `production` **não tem** "Required reviewers" nem "Wait timer". Não é
erro de configuração — é restrição de plano:

| Plano                   | Repo privado | Required reviewers |
| ----------------------- | ------------ | ------------------ |
| Free / Free for org     | privado      | **não disponível** |
| Free / Free for org     | público      | disponível         |
| Pro / Team / Enterprise | privado      | disponível         |

Este repositório é privado e está no Free.

### O que substitui a aprovação

O merge do PR `develop → main`. O `fluxo_de_versionamento.md` já define que
produção só integra após aprovação — a aprovação acontece na tela do PR, e não
na tela do workflow.

A consequência prática é pequena: o botão "Approve deployment" apareceria em
outro lugar, não em outro momento.

## O que o repositório herda

| Item                  | Visibilidade |
| --------------------- | ------------ |
| Repositório           | privado      |
| Packages no `ghcr.io` | **privadas** |

Package herda a visibilidade do repo. Como o repo é privado, a VM precisa de
credencial para `docker pull` — estar na rede não basta.

## Autenticação no registry na VM

Uma vez, por máquina. O token precisa do escopo `read:packages` — criado em
**Settings → Developer settings → Personal access tokens (classic)**. O
comando está na seção seguinte, porque tem um detalhe (`sudo`) que quebra o
deploy.

O `GITHUB_TOKEN` do workflow não serve aqui: ele vale só dentro do runner do
GitHub Actions, não na VM.

Alternativa mais correta para produção: **usuário de máquina** do GitHub
(`https://github.com/organizations/healthdevio/settings/machines`), feito para
automação. Mais um cadastro, e o token não fica preso a uma pessoa.

## O login é SEM sudo

O `ubuntu` já está no grupo `docker`, e o `deploy.sh` chama `docker` direto:

```bash
docker network create "$NETWORK"
"${compose[@]}" --env-file .env -f "$COMPOSE_FILE" pull
```

Com `sudo docker login`, a credencial vai para
`/root/.docker/config.json`. O `deploy.sh` roda como `ubuntu`, não acha o token,
e o `pull` falha com `unauthorized` — mesmo tendo sido feito o login.

```console
$ id
uid=1001(ubuntu) gid=1001(ubuntu) groups=1001(ubuntu),4(adm),24(cdrom),
27(sudo),30(dip),102(lxd),109(docker)
                                  ^^^^^^^^^ oubuntu já tem acesso ao daemon
```

## Como colar sem errar

Colar o token direto no prompt é frágil: o Termius envia o texto colado já
com Enter, e às vezes o token chega antes de o comando começar a ler. O sintoma
é o token virar argumento:

```console
$ docker login ghcr.io -u Aleczinho --password-stdin
pNCaSpPwcWmwRJfOKr04SmfaE
docker: 'docker login' requires at most 1 argument
```

O mais seguro é passar por arquivo temporário:

```bash
nano /tmp/tok
# cola o token, Ctrl+O, Enter, Ctrl+X

docker login ghcr.io -u Aleczinho --password-stdin < /tmp/tok
rm /tmp/tok
```

O `<` redireciona o arquivo para a entrada do comando: sem depender de quando o
token é colado, sem eco na tela, e sem entrar no histórico do shell.

Pelo prompt direto também funciona, mas em **dois passos separados**: digite o
comando e pressione Enter sozinho, só então cole o token e pressione Enter.

### Evite `read -s`

```bash
read -s GHCR_TOKEN          # NÃO fazer assim
```

Colando as linhas de uma vez, o `read` consome a primeira e as seguintes viram
entrada do shell — que ecoa o token na tela.

## Conferir que gravou

```bash
cat ~/.docker/config.json
```

```json
{ "auths": { "ghcr.io": { "auth": "QWxLY3ppb..." } } }
```

Se aparecer `credsStore` no lugar, o docker guardou no credential helper do
sistema — também está correto.

O valor em `auth` é base64, que é **codificação, não criptografia**: reverte-se
trivialmente. Por isso um token que apareceu em print precisa ser revogado, e
não só trocado.

## `unauthorized` vs `manifest unknown`

| Erro no `pull`     | Significa                                                              |
| ------------------ | ---------------------------------------------------------------------- |
| `unauthorized`     | login falhou, ou foi feito como outro usuário, ou o token foi revogado |
| `manifest unknown` | login ok; a imagem ainda não foi publicada                             |

`manifest unknown` logo depois de logar é o resultado esperado, porque o
`cd.yml` ainda está na `develop` e não disparou.

## Checklist

```
[ ] DEPLOY_SSH_KEY criado
[ ] DEPLOY_HOST criado
[ ] DEPLOY_USER criado
[ ] ambiente homolog criado
[ ] ambiente production criado, com "main" em Selected branches
[ ] docker login ghcr.io feito na VM, sem sudo
[ ] tokens que apareceram em print, revogados
```
