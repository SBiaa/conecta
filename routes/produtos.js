const express = require('express')
const router = express.Router()
const produtoController = require('../controllers/produtoController')

router.get('/', produtoController.listar)
router.post('/', produtoController.criar)
router.patch('/:id', produtoController.atualizar)
router.delete('/:id', produtoController.apagar)

module.exports = router
