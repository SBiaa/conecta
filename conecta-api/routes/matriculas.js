const express = require('express')
const router = express.Router()
const matriculaController = require('../controllers/matriculaController')

router.post('/', matriculaController.criar)
router.patch('/:id', matriculaController.atualizar)

module.exports = router
