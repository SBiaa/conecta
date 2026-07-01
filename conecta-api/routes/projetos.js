const express = require('express')
const router = express.Router()
const projetoController = require('../controllers/projetoController')

router.get('/', projetoController.listar)
router.post('/', projetoController.criar)
router.patch('/:id', projetoController.atualizar)

module.exports = router
