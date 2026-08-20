const express = require('express')
const router = express.Router()
const postController = require('../controllers/postController')

router.post('/', postController.criar)
router.get('/feed', postController.feed)
router.delete('/:id', postController.apagar)

router.post('/:id/reacao', postController.reagir)
router.delete('/:id/reacao', postController.removerReacao)

router.get('/:id/comentarios', postController.listarComentarios)
router.post('/:id/comentarios', postController.comentar)
router.delete('/:id/comentarios/:comentarioId', postController.apagarComentario)

module.exports = router
