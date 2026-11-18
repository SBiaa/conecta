# Portão com celular (sem fechadura)

Um celular Android preso na parede do portão lê o chaveiro NFC da aluna e mostra
a tela **verde** ("Olá, Ana! Pode entrar") ou **vermelha** ("Procure a
secretaria"), com bip e vibração. Não abre nem trava nada: quem barra é a pessoa
que está na entrada olhando a tela.

Usa a mesma API, a mesma regra e os mesmos chaveiros do portão com ESP32
(`hardware/portao-esp32`). Dá pra começar pelo celular e colocar a fechadura
depois sem recadastrar ninguém.

## O que precisa

- **Celular Android com NFC** e Google Chrome atualizado. iPhone não serve (o
  Safari não deixa página ler NFC).
- Carregador na tomada e um suporte de parede.
- **Chaveiros NFC NTAG213** (R$ 1–3 cada). Prefira NTAG213/215 aos "Mifare
  Classic 1K" que vêm junto com o leitor RC522: muitos celulares (Samsung,
  Motorola) não leem Mifare Classic. NTAG213 funciona no celular **e** no
  RC522 do ESP32.
- A API publicada em **https://** (o Chrome só libera NFC em página segura).

Antes de comprar chaveiros em quantidade, teste um no celular que vai ficar no
portão.

## Configurar (uma vez)

1. Rodar a migração do banco, se ainda não rodou: `npx prisma migrate deploy`.
2. No celular, abrir no Chrome: `https://SEU-ENDERECO-DA-API/tela-portao/`
3. Entrar com CPF e senha da coordenação. O celular é cadastrado como aparelho
   do portão e guarda um token próprio; a senha não fica salva.
4. Tocar em **Iniciar portão** e em **Permitir** quando o Chrome pedir o NFC.
5. Recomendado:
   - Chrome → menu ⋮ → **Adicionar à tela inicial**, pra abrir direto.
   - Android → **Fixar app** (Configurações → Segurança), pra ninguém sair da tela.
   - Configurações → Tela → tempo de tela o maior possível (a página já pede
     pra tela não apagar, mas alguns aparelhos ignoram).

Se o celular reiniciar ou o Chrome fechar, é só abrir de novo e tocar em
**Iniciar portão** (o navegador exige um toque pra ligar o NFC).

## Cadastrar chaveiros

Na tela do portão, toque na engrenagem ⚙ (canto inferior direito) e entre com a
senha da coordenação → **Cadastrar chaveiros** → busque a pessoa pelo nome →
encoste o chaveiro. A tela também mostra se a pessoa entraria hoje e por quê.

## Sem internet

O celular guarda a lista de quem está liberado (atualizada a cada 5 minutos) e
continua funcionando com ela, avisando "modo sem internet" na tela. As entradas
desse período são enviadas pro registro quando a conexão volta.

## Regra

A mesma do portão com ESP32. Veja "Regra de liberação" em
`hardware/portao-esp32/README.md`. Tolerância e bloqueio por exame mudam pelas
variáveis `ACESSO_TOLERANCIA_DIAS` e `ACESSO_BLOQUEAR_NAO_APTO`.
