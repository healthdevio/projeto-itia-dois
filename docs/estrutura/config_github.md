# Configuração do GitHub

Passos manuais feitos uma vez no repositório. Não estão em código — vivem nas
settings do GitHub, e por isso não aparecem em nenhum `git log`.

Onde: `github.com/healthdevio/projeto-itia-dois` → **Settings**.

## Secrets do repositório

Em **Settings → Secrets and variables → Actions → New repository secret**.

| Secret                   | Valor                                 | Para quê                   |
| ------------------------ | ------------------------------------- | -------------------------- |
| `PW2C_REGISTRY_USERNAME` | usuário do registry da empresa        | publicar as imagens        |
| `PW2C_REGISTRY_PASSWORD` | senha ou token do registry            | idem                       |
| `PORTAINER_URL`          | `https://portainer.da.empresa.com.br` | endereço do Portainer      |
| `PORTAINER_API_KEY`      | token de acesso do Portainer          | atualizar a stack pela API |
| `PORTAINER_STACK_ID`     | id da stack `omnia`                   | qual stack atualizar       |
| `PORTAINER_ENDPOINT_ID`  | id do ambiente Swarm                  | qual cluster               |

O GitHub mostra só o nome, nunca o valor.

### Os dois ids que não dá para adivinhar

**`PORTAINER_STACK_ID`** aparece na URL da tela da stack:

```
https://portainer.da.empresa.com.br/#!/stacks/1/view
                                          ^ o id da stack
```

**`PORTAINER_ENDPOINT_ID`** fica em **Home** do Portainer, ou em **Settings →
Endpoints**. Em um cluster com um único ambiente, quase sempre é `1`.

## Token da API do Portainer

Em **Account settings → Access tokens → Add access token**.

O token precisa de escopo de escrita em stacks. **Copie uma vez** — não dá para
reexibir depois, e é preciso gerar outro se perder.

## Por que o token e não uma senha

O `deploy-pw2c.yml` não usa `username`/`password` do Portainer. Usa token, porque
é revogável sem trocar senha, e o escopo é explícito: o token faz o que o
deploy precisa e nada mais.

## O registry

O registry é da empresa, não do GitHub:

```
registry.cloud.grupopw2c.com.br
```

Isso muda duas coisas em relação ao `ghcr.io`:

|                        | `ghcr.io`                  | Registry da empresa                    |
| ---------------------- | -------------------------- | -------------------------------------- |
| Credencial no workflow | `GITHUB_TOKEN`, automático | `PW2C_REGISTRY_PASSWORD`, criado à mão |
| Visibilidade           | herda do repositório       | a que a empresa definir                |

O repositório continua privado. O `deploy-pw2c.yml` não precisa de
`packages: write` — as permissões padrão bastam, porque não é o GitHub Packages.

## Autenticação no cluster

O cluster precisa da **mesma** credencial para o `pull`. Uma vez, no servidor:

```bash
printf 'usuario' | docker login registry.cloud.grupopw2c.com.br --password-stdin
```

Conferir:

```bash
cat ~/.docker/config.json
```

```json
{ "auths": { "registry.cloud.grupopw2c.com.br": { "auth": "QWxLY3ppb..." } } }
```

O valor em `auth` é base64, que é **codificação, não criptografia**: reverte-se
trivialmente. Por isso uma senha que apareceu em print precisa ser revogada, e não
só trocada.

### Divergência é a causa mais comum

O segredo no GitHub e a credencial no cluster são dois lugares independentes.
Trocar no GitHub e esquecer no cluster produz `unauthorized` no `pull` — com o
workflow inteiro verde.

## Ambientes

O `deploy-pw2c.yml` **não usa GitHub Environments**. A proteção de produção
acontece pelo merge do PR, não por approval na tela do workflow.

Se a empresa quiser aprovação explícita antes de atualizar a stack, dá para
adicionar o `environment: production` no job e configurar a protection em
Settings → Environments. Não é necessário para o funcionar.

## `unauthorized` vs `manifest unknown`

| Erro no `pull`     | Significa                                                     |
| ------------------ | ------------------------------------------------------------- |
| `unauthorized`     | login falhou, ou a credencial divergiu entre GitHub e cluster |
| `manifest unknown` | login ok; a imagem ainda não foi publicada                    |

## Checklist

```
[ ] PW2C_REGISTRY_USERNAME criado
[ ] PW2C_REGISTRY_PASSWORD criado
[ ] PORTAINER_URL criado
[ ] PORTAINER_API_KEY criado
[ ] PORTAINER_STACK_ID criado
[ ] PORTAINER_ENDPOINT_ID criado
[ ] docker login no registry feito no cluster
[ ] OMNIA_CORE_IMAGE e OMNIA_WEB_IMAGE presentes no .Env da stack
[ ] tokens que apareceram em print, revogados
```

Os dois últimos itens não são do GitHub, mas o deploy falha sem eles. Ver
[pré-requisitos](../ci_cd/pre-requisitos.md).
