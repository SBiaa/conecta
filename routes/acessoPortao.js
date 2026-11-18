const express = require('express')
const router = express.Router()
const portaoController = require('../controllers/portaoController')

// Coordenação: aparelhos, log de entradas e cadastro de chaveiros
router.get('/dispositivos', portaoController.listarDispositivos)
router.post('/dispositivos', portaoController.criarDispositivo)
router.patch('/dispositivos/:id', portaoController.atualizarDispositivo)
router.post('/dispositivos/:id/novo-token', portaoController.novoTokenDispositivo)
router.get('/acessos', portaoController.listarAcessos)
router.get('/tags-desconhecidas', portaoController.tagsDesconhecidas)
router.get('/usuarios/:id/situacao', portaoController.situacao)
router.put('/usuarios/:id/tag', portaoController.vincularTag)
router.delete('/usuarios/:id/tag', portaoController.desvincularTag)

module.exports = router
