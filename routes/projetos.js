const express = require('express')
const router = express.Router()
const projetoController = require('../controllers/projetoController')

router.get('/', projetoController.listar)
router.get('/valores', projetoController.listarValores)
router.get('/:id/valores', projetoController.buscarValores)
router.put('/:id/valores', projetoController.salvarValores)
router.post('/', projetoController.criar)
router.patch('/:id', projetoController.atualizar)

module.exports = router
