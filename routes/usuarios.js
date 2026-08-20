const express = require('express')
const router = express.Router()
const usuarioController = require('../controllers/usuarioController')
const saudeController = require('../controllers/saudeController')

router.get('/', usuarioController.listar)
router.get('/:id', usuarioController.buscarPorId)
router.get('/:id/saude', saudeController.relatorioDaAluna)
router.post('/', usuarioController.criar)
router.patch('/:id', usuarioController.atualizar)
router.patch('/:id/senha', usuarioController.atualizarSenha)

module.exports = router
