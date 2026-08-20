const express = require('express')
const router = express.Router()
const despesaController = require('../controllers/despesaController')

router.get('/', despesaController.listar)
router.post('/', despesaController.criar)
router.patch('/:id', despesaController.atualizar)
router.delete('/:id', despesaController.apagar)

module.exports = router
