// Copie este arquivo para config.h (que NÃO vai pro git) e preencha.

#pragma once

#define WIFI_SSID  "nome-da-rede"
#define WIFI_SENHA "senha-da-rede"

// Endereço da API, sem barra no final
#define API_URL "https://api.seudominio.com.br"

// Token gerado em POST /acesso-portao/dispositivos (aparece uma vez só)
#define DISPOSITIVO_TOKEN "cole-o-token-aqui"

// Certificado raiz (PEM) do servidor da API. Vazio = conexão cifrada sem
// conferir o servidor; funciona, mas o ideal é preencher.
#define API_ROOT_CA ""

// Quanto tempo o relé fica acionado.
//   Fechadura eletromecânica (a de interfone, abre com pulso): ~1000
//   Eletroímã (fica travado enquanto tem energia):            ~4000
#define TEMPO_ABERTO_MS 4000

// Nível que liga o relé. A maioria dos módulos de relé de 1 canal liga em LOW.
#define RELE_ATIVO LOW
