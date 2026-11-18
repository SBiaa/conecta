const express = require('express')
const router = express.Router()
const viagem = require('../controllers/viagemController')
const { exigirPapel } = require('../middlewares/auth')

const soAdmin = exigirPapel('ADMIN')

// Participantes (e coordenação). O acesso a cada viagem é conferido no
// controller: só quem está na lista enxerga.
router.get('/', viagem.listar)
router.get('/:id', viagem.detalhar)
router.put('/:id/checklist/:itemId', viagem.marcarChecklist)
router.get('/:id/midias', viagem.listarMidias)
router.post('/:id/midias/upload-token', viagem.tokenDeUpload)
router.post('/:id/midias', viagem.registrarMidia)
router.delete('/:id/midias/:midiaId', viagem.apagarMidia)
router.get('/:id/ranking', viagem.ranking)

// Só coordenação.
router.post('/', soAdmin, viagem.criar)
router.put('/:id', soAdmin, viagem.atualizar)
router.delete('/:id', soAdmin, viagem.apagar)
router.post('/:id/participantes', soAdmin, viagem.adicionarParticipantes)
router.delete('/:id/participantes/:usuarioId', soAdmin, viagem.removerParticipante)
router.post('/:id/eventos', soAdmin, viagem.criarEvento)
router.put('/:id/eventos/:eventoId', soAdmin, viagem.atualizarEvento)
router.delete('/:id/eventos/:eventoId', soAdmin, viagem.apagarEvento)
router.post('/:id/avisos', soAdmin, viagem.criarAviso)
router.delete('/:id/avisos/:avisoId', soAdmin, viagem.apagarAviso)
router.post('/:id/checklist', soAdmin, viagem.criarItemChecklist)
router.delete('/:id/checklist/:itemId', soAdmin, viagem.apagarItemChecklist)
router.put('/:id/midias/:midiaId/nota', soAdmin, viagem.darNota)

module.exports = router
