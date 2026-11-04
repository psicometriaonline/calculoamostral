# calculoamostral.com.br

Site da Calculadora Amostral da Psicometria Online: página principal pública, login só com e-mail (código de 6 dígitos ou link enviado pelo Resend) e a calculadora de tamanho amostral (poder e precisão) para quem entrou.

## Como está organizado

| Pasta | O que tem |
| --- | --- |
| `client/index.html`, `client/src/landing.*` | página principal (design A aprovado) e o fluxo e-mail → código |
| `client/app/src` | calculadora (mesmas páginas do app da Academy, versão do bundle de 04/11/2026) |
| `client/privacidade.html`, `client/termos.html` | textos legais (rascunho; revisar antes do lançamento) |
| `shared/` | motor estatístico, idêntico ao do Replit |
| `server/` | API Express: login, sessão, cálculo, histórico, Resend, Turnstile e fila do ActiveCampaign |
| `server/calc/` | handlers de cálculo, os mesmos trechos das rotas do Replit |
| `server/migrations/` | estrutura do banco (aplicada automaticamente ao iniciar) |
| `tests/` | paridade com o G*Power, regressão e integração com Postgres real |

## Rodar localmente

```sh
npm install --legacy-peer-deps
npm run build:client
DATABASE_URL=postgres://… SESSION_SECRET=$(openssl rand -base64 48) npm run dev
```

Sem `RESEND_API_KEY`, o código de acesso aparece no log do servidor.

## Testes

```sh
npx vitest run --config vitest.config.mjs   # paridade e sensibilidade (54)
npx tsx tests/regression-power.test.ts      # regressão do motor (91)
npx tsx tests/integration.test.ts           # integração (13), Postgres embutido
```

O teste de integração usa `embedded-postgres` (dependência opcional). O Postgres não roda como root, então use um usuário comum.

## Deploy no Coolify (VPS da Hostinger)

1. **DNS (hPanel › calculoamostral.com.br › DNS):**
   - `A @ → 31.97.21.87` e `A www → 31.97.21.87`
   - `A painel → 31.97.21.87` (painel do Coolify com HTTPS)
   - registros do Resend para `acesso.calculoamostral.com.br` (DKIM, MX e SPF), copiados do painel do Resend
2. **Resend:** adicionar o domínio `acesso.calculoamostral.com.br` e criar uma chave **só de envio, restrita a esse domínio**. A chave e o domínio do site principal não mudam.
3. **Cloudflare Turnstile:** criar o widget para `calculoamostral.com.br` e copiar a chave do site e a chave secreta.
4. **Coolify:**
   - criar um Postgres (backup diário ligado);
   - criar o app a partir deste repositório, tipo **Dockerfile**, porta 3000, domínios `https://calculoamostral.com.br` e `https://www.calculoamostral.com.br` (redirecionar www para o principal);
   - preencher as variáveis do `.env.example`;
   - health check em `/healthz`.
5. **ActiveCampaign:** criar o campo personalizado "Calculadora: aceite de marketing" e colocar o id em `AC_MARKETING_FIELD_ID`. O site cria as tags `[POA][CALC] …` sozinho na primeira vez. Ele nunca inscreve em lista, nunca adiciona a automação e nunca envia e-mail.

## Limites e segurança

- Código: 10 minutos, 5 tentativas, reenvio após 60 s, no máximo 5 por e-mail por hora e 10 por IP por hora.
- Teto diário de e-mails (`MAIL_DAILY_CAP`) e no máximo `MAIL_PER_SECOND` envios por segundo, para não disputar o limite da conta do Resend com o Replit.
- Códigos, links e sessões só são guardados como HMAC. O cookie de sessão é `HttpOnly`, `Secure` e `SameSite=Lax`, e há checagem de origem em todo POST.
- Cálculo: 120 por minuto por pessoa; corpo de no máximo 100 KB.

## Manter igual ao Replit

`shared/` e `server/calc/` vêm do bundle de mudanças de 04/11/2026. Qualquer mudança no motor deve ser feita nos dois lugares e validada pelos testes de paridade.
