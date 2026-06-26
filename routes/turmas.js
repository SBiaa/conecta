const express = require('express')
const router = express.Router()
const turmaController = require('../controllers/turmaController')

router.get('/', turmaController.listar)
router.post('/', turmaController.criar)
router.patch('/:id', turmaController.atualizar)
router.get('/:id/matriculas', turmaController.matriculasDaTurma)

module.exports = router
