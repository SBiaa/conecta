# Portão com chaveiro NFC (ESP32)

A aluna encosta o chaveiro no leitor, o ESP32 pergunta à API se ela pode
entrar e, se puder, abre a fechadura. Não precisa de computador no portão.

```
chaveiro NFC ──► leitor RC522 ──► ESP32 ──wifi──► API Conecta (POST /portao/verificar)
                                    │
                                    └──► relé ──► fechadura do portão
```

Se a internet cair, o ESP32 continua funcionando com a última lista de quem
está liberado (salva na memória, atualizada a cada 5 minutos) e manda o
registro dessas entradas quando a conexão volta.

## Lista de compras (preços aproximados)

| Item | Qtd | Preço aprox. |
|---|---|---|
| ESP32 DevKit V1 (38 pinos) | 1 | R$ 40–60 |
| Leitor RFID/NFC RC522 13,56 MHz (normalmente já vem com 1 cartão e 1 chaveiro) | 1 | R$ 15–25 |
| Módulo relé 1 canal 5 V | 1 | R$ 8–15 |
| Fonte 12 V 2 A (alimenta a fechadura) | 1 | R$ 25–40 |
| Regulador step-down 12 V → 5 V (LM2596 ou similar), pra alimentar o ESP32 pela mesma fonte | 1 | R$ 8–15 |
| LED verde, LED vermelho, 2 resistores de 220 Ω, buzzer ativo 5 V | 1 de cada | R$ 5 |
| Caixa plástica com tampa (sobrepor, à prova d'água se ficar exposta) | 1 | R$ 15–30 |
| Botão de saída de controle de acesso (com contatos NA e NF) | 1 | R$ 15–30 |
| Chaveiros NFC Mifare 13,56 MHz | 1 por aluna | R$ 1–3 cada |
| **Fechadura** (ver abaixo) | 1 | R$ 120–400 |

Total sem a fechadura: em torno de R$ 150–250.

### Qual fechadura

- **O portão já tem fechadura elétrica de interfone (eletromecânica 12 V)?**
  Ótimo, usa ela. O relé faz o mesmo papel do botão do interfone: dá um pulso e
  ela destrava. Use `TEMPO_ABERTO_MS` em torno de `1000`.
- **Não tem?** Prefira o **eletroímã** (fecho magnético 150–280 kg). Ele fica
  travado enquanto tem energia e **abre sozinho se faltar luz**, o que é o mais
  seguro pra uma saída de pessoas. Use `TEMPO_ABERTO_MS` em torno de `4000`.

> Peça pra um eletricista fazer a parte da fechadura e da fonte de 12 V. A parte
> do ESP32 é baixa tensão e qualquer pessoa consegue montar.

## Ligações

**RC522 → ESP32** (o RC522 é 3,3 V — **não** ligue no 5 V)

| RC522 | ESP32 |
|---|---|
| SDA (SS) | GPIO 5 |
| SCK | GPIO 18 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| RST | GPIO 22 |
| GND | GND |
| 3.3V | 3V3 |
| IRQ | (não usa) |

**Saídas**

| Componente | ESP32 |
|---|---|
| Relé IN | GPIO 26 (VCC do relé no 5 V, GND no GND) |
| LED verde (+ resistor 220 Ω) | GPIO 25 |
| LED vermelho (+ resistor 220 Ω) | GPIO 33 |
| Buzzer (+) | GPIO 27 |

**Fechadura no relé**

- Eletroímã: 12 V → **NF** (normalmente fechado) do relé → eletroímã. Quando o
  relé liga, corta a energia e a porta abre.
- Fechadura de interfone: 12 V → **NA** (normalmente aberto) do relé → fechadura.
  Quando o relé liga, dá o pulso que destrava.

**Botão de saída:** ligado direto no circuito da fechadura, **sem passar pelo
ESP32**: no eletroímã, contato **NF** do botão em série (apertou, corta a
energia); na fechadura de interfone, contato **NA** em paralelo com o relé. Assim dá pra sair mesmo se o ESP32 travar.

Leitor do lado de fora; ESP32, relé e fonte do lado de dentro. O RC522 lê
através de plástico e madeira fina (~3 cm), não através de metal: se o portão
for de ferro, o leitor precisa ficar numa caixinha plástica afastada do metal.

## Configuração

1. **Banco:** rodar a migração `prisma/migrations/20261118120000_acesso_portao_nfc`
   (`npx prisma migrate deploy`).
2. **Regra** (variáveis de ambiente da API, opcionais):
   - `ACESSO_TOLERANCIA_DIAS` — dias depois do vencimento até barrar. Padrão `10`.
   - `ACESSO_BLOQUEAR_NAO_APTO` — `true` barra quem está com exame `NAO_APTO`. Padrão `false`.
3. **Cadastrar o aparelho:** logado como ADMIN,
   `POST /acesso-portao/dispositivos` com `{ "nome": "Portão principal" }`.
   A resposta traz o `token` — **ele só aparece essa vez**.
4. **Gravar o ESP32:**
   - Arduino IDE → instalar a placa "esp32" (Espressif) e as bibliotecas
     **MFRC522** e **ArduinoJson** (v7).
   - Copiar `config.exemplo.h` para `config.h` e preencher Wi-Fi, `API_URL`
     e o token. (`config.h` não vai pro git.)
   - Placa "ESP32 Dev Module" → Upload. Abra o Monitor Serial (115200) pra ver
     as leituras.
5. **Cadastrar os chaveiros:** encoste o chaveiro novo no leitor (vai dar
   negado: "cartão não cadastrado"). Ele aparece em
   `GET /acesso-portao/tags-desconhecidas`; vincule com
   `PUT /acesso-portao/usuarios/:id/tag` `{ "tagNfc": "04A1B2C3" }`.

## API

**Aparelho** (header `X-Dispositivo-Token`):

| Rota | O que faz |
|---|---|
| `POST /portao/verificar` `{ tag }` | Decide e registra. Responde `{ liberado, mensagem }` |
| `GET /portao/liberados` | Lista de tags liberadas, pro modo offline |
| `POST /portao/acessos-offline` `{ acessos: [{ tag, liberado, segundosAtras }] }` | Registra entradas feitas sem internet |

**Coordenação** (JWT de ADMIN):

| Rota | O que faz |
|---|---|
| `GET/POST /acesso-portao/dispositivos` | Lista / cadastra aparelho (devolve o token) |
| `PATCH /acesso-portao/dispositivos/:id` `{ nome?, ativo? }` | Renomeia / desativa |
| `POST /acesso-portao/dispositivos/:id/novo-token` | Troca o token (o antigo para na hora) |
| `GET /acesso-portao/acessos?limite=&usuarioId=&negados=true` | Log de entradas |
| `GET /acesso-portao/tags-desconhecidas` | Chaveiros lidos nas últimas 24 h que ainda não têm dona |
| `PUT/DELETE /acesso-portao/usuarios/:id/tag` | Vincula / desvincula chaveiro |
| `GET /acesso-portao/usuarios/:id/situacao` | Diz se a pessoa entraria agora e por quê |

### Regra de liberação

- ADMIN e PROFESSOR ativos: sempre liberados.
- Associado precisa estar ATIVO, ter pelo menos uma matrícula ativa e nenhuma
  cobrança PENDENTE vencida há mais de `ACESSO_TOLERANCIA_DIAS` dias.
- Se `ACESSO_BLOQUEAR_NAO_APTO=true`, também barra quem tem exame `NAO_APTO`
  em todas as matrículas ativas.
- No portão aparece só "Procure a secretaria"; o motivo
  (`MENSALIDADE_ATRASADA`, `SEM_MATRICULA_ATIVA`...) fica no log pra coordenação.

## Limitações conhecidas

- Chaveiro Mifare comum pode ser **emprestado** ou até **copiado** (o UID é
  público). Pra uma associação isso costuma bastar; se virar problema, o caminho
  é biometria/facial.
- Sem internet, vale a lista da última atualização: quem pagou nos últimos
  minutos só entra quando a lista atualizar; quem atrasou continua entrando até
  lá.
- Se o aparelho for desativado na API, ele entra no modo offline com a última
  lista salva (de propósito, pra um erro de configuração não trancar todo
  mundo). Pra bloquear de verdade, desligue o aparelho.
