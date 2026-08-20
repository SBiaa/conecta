const express = require('express')
const router = express.Router()
const vendaController = require('../controllers/vendaController')

router.get('/', vendaController.listar)
router.post('/', vendaController.criar)
router.delete('/:id', vendaController.apagar)

module.exports = router
