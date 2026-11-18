const express = require('express')
const router = express.Router()
const portaoController = require('../controllers/portaoController')

// Chamadas pelo aparelho do portão (ESP32), autenticadas por token do dispositivo
router.post('/verificar', portaoController.verificar)
router.get('/liberados', portaoController.liberados)
router.post('/acessos-offline', portaoController.registrarOffline)

module.exports = router
