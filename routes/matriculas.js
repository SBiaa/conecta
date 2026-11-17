const express = require('express')
const router = express.Router()
const matriculaController = require('../controllers/matriculaController')

router.post('/', matriculaController.criar)
router.post('/encerrar-em-lote', matriculaController.encerrarEmLote)
router.patch('/:id', matriculaController.atualizar)
router.delete('/:id', matriculaController.remover)

module.exports = router
