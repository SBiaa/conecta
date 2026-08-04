const express = require('express')
const router = express.Router()
const usuarioController = require('../controllers/usuarioController')

router.get('/', usuarioController.listar)
router.get('/:id', usuarioController.buscarPorId)
router.post('/', usuarioController.criar)
router.patch('/:id', usuarioController.atualizar)
router.patch('/:id/senha', usuarioController.atualizarSenha)

module.exports = router
