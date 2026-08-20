const express = require('express')
const router = express.Router()
const categoriaDespesaController = require('../controllers/categoriaDespesaController')

router.get('/', categoriaDespesaController.listar)
router.post('/', categoriaDespesaController.criar)
router.patch('/:id', categoriaDespesaController.atualizar)
router.delete('/:id', categoriaDespesaController.apagar)

module.exports = router
