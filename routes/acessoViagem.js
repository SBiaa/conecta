const express = require('express')
const router = express.Router()
const acesso = require('../controllers/acessoViagemController')

// Sem login: é a porta de entrada de quem recebeu o link da viagem.
router.get('/:codigo', acesso.verLink)
router.post('/:codigo', acesso.entrar)

module.exports = router
