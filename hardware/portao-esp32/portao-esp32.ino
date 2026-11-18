// Portão Conecta — ESP32 + leitor NFC RC522 + relé da fechadura.
//
// Fluxo: aluna encosta o chaveiro -> ESP32 lê o UID -> pergunta à API
// (POST /portao/verificar) -> se liberado, aciona o relé por alguns segundos.
//
// Sem internet: decide pela última lista de liberados (GET /portao/liberados),
// que fica salva na memória flash e é atualizada a cada poucos minutos. As
// entradas decididas offline são enviadas depois (POST /portao/acessos-offline).
//
// Bibliotecas (Arduino IDE > Gerenciar bibliotecas):
//   - MFRC522 (GithubCommunity / miguelbalboa)
//   - ArduinoJson (Benoit Blanchon), versão 7
// Placa: "ESP32 Dev Module" (pacote esp32 da Espressif).
//
// Ligações e lista de compras: veja README.md nesta pasta.

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>
#include <vector>

#include "config.h"  // copie config.exemplo.h para config.h e preencha

// ---------------------------------------------------------------------------
// Pinos
// ---------------------------------------------------------------------------
// RC522 no SPI padrão do ESP32: SCK=18, MISO=19, MOSI=23
const int PINO_RC522_SS  = 5;
const int PINO_RC522_RST = 22;
const int PINO_RELE      = 26;
const int PINO_LED_VERDE = 25;
const int PINO_LED_VERM  = 33;
const int PINO_BUZZER    = 27;

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------
const unsigned long INTERVALO_LISTA_MS   = 5UL * 60 * 1000;  // atualiza lista offline
const unsigned long INTERVALO_REINIT_MS  = 10UL * 60 * 1000; // RC522 às vezes trava; reinicia
const unsigned long TIMEOUT_HTTP_MS      = 3000;             // espera da API antes de ir pro offline
const unsigned long MESMO_CARTAO_MS      = 3000;             // ignora o mesmo cartão repetido
const size_t        MAX_FILA_OFFLINE     = 60;

MFRC522 leitor(PINO_RC522_SS, PINO_RC522_RST);
Preferences prefs;

std::vector<String> liberadosCache;

struct AcessoOffline {
  String tag;
  bool liberado;
  unsigned long quando;  // millis()
};
std::vector<AcessoOffline> filaOffline;

unsigned long ultimaLista = 0;
unsigned long ultimoReinit = 0;
String ultimoCartao;
unsigned long ultimoCartaoEm = 0;

// ---------------------------------------------------------------------------
// Feedback (LED, buzzer, relé)
// ---------------------------------------------------------------------------
void bip(int vezes, int duracao) {
  for (int i = 0; i < vezes; i++) {
    digitalWrite(PINO_BUZZER, HIGH);
    delay(duracao);
    digitalWrite(PINO_BUZZER, LOW);
    if (i < vezes - 1) delay(duracao);
  }
}

void liberar() {
  digitalWrite(PINO_LED_VERDE, HIGH);
  digitalWrite(PINO_RELE, RELE_ATIVO);
  bip(1, 150);
  delay(TEMPO_ABERTO_MS);
  digitalWrite(PINO_RELE, !RELE_ATIVO);
  digitalWrite(PINO_LED_VERDE, LOW);
}

void negar() {
  digitalWrite(PINO_LED_VERM, HIGH);
  bip(3, 120);
  delay(1200);
  digitalWrite(PINO_LED_VERM, LOW);
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
// Faz a requisição; devolve o status HTTP (ou <0 em erro de rede) e o corpo.
int requisicao(const char* metodo, const String& caminho, const String& corpo, String& resposta) {
  if (WiFi.status() != WL_CONNECTED) return -1;

  String url = String(API_URL) + caminho;
  // clientes declarados antes do HTTPClient: são destruídos depois dele
  WiFiClientSecure seguro;
  WiFiClient simples;
  HTTPClient http;

  bool ok;
  if (url.startsWith("https://")) {
    if (strlen(API_ROOT_CA) > 0) {
      seguro.setCACert(API_ROOT_CA);
    } else {
      // Sem certificado configurado: cifra a conexão mas não confere o servidor.
      // Preencha API_ROOT_CA no config.h pra fechar essa brecha.
      seguro.setInsecure();
    }
    ok = http.begin(seguro, url);
  } else {
    ok = http.begin(simples, url);
  }
  if (!ok) return -2;

  http.setTimeout(TIMEOUT_HTTP_MS);
  http.setConnectTimeout(TIMEOUT_HTTP_MS);
  http.addHeader("X-Dispositivo-Token", DISPOSITIVO_TOKEN);
  http.addHeader("Content-Type", "application/json");

  int status = http.sendRequest(metodo, corpo);
  if (status > 0) resposta = http.getString();
  http.end();
  return status;
}

// ---------------------------------------------------------------------------
// Lista offline
// ---------------------------------------------------------------------------
void salvarCache() {
  String junta;
  for (size_t i = 0; i < liberadosCache.size(); i++) {
    if (i) junta += ',';
    junta += liberadosCache[i];
  }
  prefs.putBytes("lista", junta.c_str(), junta.length());
}

void carregarCache() {
  liberadosCache.clear();
  size_t tamanho = prefs.getBytesLength("lista");
  if (tamanho == 0) return;
  std::vector<char> buf(tamanho + 1, 0);
  prefs.getBytes("lista", buf.data(), tamanho);
  String junta(buf.data());
  int inicio = 0;
  while (inicio < (int)junta.length()) {
    int virgula = junta.indexOf(',', inicio);
    if (virgula < 0) virgula = junta.length();
    if (virgula > inicio) liberadosCache.push_back(junta.substring(inicio, virgula));
    inicio = virgula + 1;
  }
  Serial.printf("Lista offline carregada da flash: %u tags\n", (unsigned)liberadosCache.size());
}

void atualizarLista() {
  String resposta;
  int status = requisicao("GET", "/portao/liberados", "", resposta);
  if (status != 200) {
    Serial.printf("Falha ao atualizar lista (%d)\n", status);
    return;
  }
  JsonDocument doc;
  if (deserializeJson(doc, resposta)) return;

  liberadosCache.clear();
  for (JsonVariant t : doc["tags"].as<JsonArray>()) liberadosCache.push_back(t.as<String>());
  salvarCache();
  Serial.printf("Lista offline atualizada: %u tags\n", (unsigned)liberadosCache.size());
}

bool estaNaLista(const String& tag) {
  for (const String& t : liberadosCache) {
    if (t == tag) return true;
  }
  return false;
}

void enviarFilaOffline() {
  if (filaOffline.empty()) return;

  JsonDocument doc;
  JsonArray lista = doc["acessos"].to<JsonArray>();
  unsigned long agora = millis();
  for (const AcessoOffline& a : filaOffline) {
    JsonObject o = lista.add<JsonObject>();
    o["tag"] = a.tag;
    o["liberado"] = a.liberado;
    o["segundosAtras"] = (agora - a.quando) / 1000;
  }
  String corpo, resposta;
  serializeJson(doc, corpo);
  if (requisicao("POST", "/portao/acessos-offline", corpo, resposta) == 200) {
    Serial.printf("Enviados %u acessos offline\n", (unsigned)filaOffline.size());
    filaOffline.clear();
  }
}

// ---------------------------------------------------------------------------
// Leitura do cartão
// ---------------------------------------------------------------------------
String uidHex() {
  String s;
  for (byte i = 0; i < leitor.uid.size; i++) {
    if (leitor.uid.uidByte[i] < 0x10) s += '0';
    s += String(leitor.uid.uidByte[i], HEX);
  }
  s.toUpperCase();
  return s;
}

void tratarCartao(const String& tag) {
  Serial.printf("Cartão: %s\n", tag.c_str());

  String corpo = "{\"tag\":\"" + tag + "\"}";
  String resposta;
  int status = requisicao("POST", "/portao/verificar", corpo, resposta);

  if (status == 200) {
    JsonDocument doc;
    if (!deserializeJson(doc, resposta)) {
      bool ok = doc["liberado"] | false;
      Serial.printf("API: %s (%s)\n", ok ? "LIBERADO" : "NEGADO", doc["mensagem"] | "");
      ok ? liberar() : negar();
      return;
    }
  }

  // API fora do ar, sem internet ou resposta estranha: decide pela lista salva.
  // 401 (token errado/aparelho desativado) também cai aqui de propósito — o
  // portão não pode travar todo mundo por erro de configuração; fica no log.
  bool ok = estaNaLista(tag);
  Serial.printf("OFFLINE (status %d): %s\n", status, ok ? "LIBERADO" : "NEGADO");
  if (filaOffline.size() >= MAX_FILA_OFFLINE) filaOffline.erase(filaOffline.begin());
  filaOffline.push_back({tag, ok, millis()});
  ok ? liberar() : negar();
}

// ---------------------------------------------------------------------------
void conectarWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_SENHA);
  Serial.print("Conectando ao Wi-Fi");
  for (int i = 0; i < 20 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print('.');
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " ok" : " sem conexão (segue offline)");
}

void setup() {
  Serial.begin(115200);

  pinMode(PINO_RELE, OUTPUT);
  digitalWrite(PINO_RELE, !RELE_ATIVO);
  pinMode(PINO_LED_VERDE, OUTPUT);
  pinMode(PINO_LED_VERM, OUTPUT);
  pinMode(PINO_BUZZER, OUTPUT);

  prefs.begin("portao", false);
  carregarCache();

  SPI.begin();
  leitor.PCD_Init();
  ultimoReinit = millis();

  conectarWifi();
  atualizarLista();
  ultimaLista = millis();
  bip(2, 60);  // pronto
}

void loop() {
  unsigned long agora = millis();

  if (agora - ultimaLista >= INTERVALO_LISTA_MS) {
    ultimaLista = agora;
    atualizarLista();
    enviarFilaOffline();
  }

  if (agora - ultimoReinit >= INTERVALO_REINIT_MS) {
    ultimoReinit = agora;
    leitor.PCD_Init();
  }

  if (!leitor.PICC_IsNewCardPresent() || !leitor.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  String tag = uidHex();
  leitor.PICC_HaltA();
  leitor.PCD_StopCrypto1();

  if (tag == ultimoCartao && agora - ultimoCartaoEm < MESMO_CARTAO_MS) return;
  ultimoCartao = tag;
  ultimoCartaoEm = agora;

  tratarCartao(tag);
  enviarFilaOffline();  // se voltou a ter internet, aproveita
}
