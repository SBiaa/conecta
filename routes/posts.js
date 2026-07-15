const express = require('express')
const router = express.Router()
const postController = require('../controllers/postController')

router.post('/', postController.criar)
router.get('/feed', postController.feed)
router.delete('/:id', postController.apagar)

module.exports = router
