const express = require('express')
const router = express.Router()
const associadosController = require('../controllers/associadosController')

router.get('/', associadosController.listar)
router.post('/', associadosController.criar)
router.get('/:id', associadosController.buscarPorId)
router.put('/:id', associadosController.atualizar)

module.exports = router