const express = require('express')
const cors = require('cors')
require('dotenv').config()

const authRoutes = require('./routes/auth')
const associadosRoutes = require('./routes/associados')
const usuariosRoutes = require('./routes/usuarios')
const projetosRoutes = require('./routes/projetos')
const turmasRoutes = require('./routes/turmas')
const matriculasRoutes = require('./routes/matriculas')
const pagamentosRoutes = require('./routes/pagamentos')
const { autenticar, exigirPapel } = require('./middlewares/auth')
const app = express()

app.use(cors())
app.use(express.json())

// ...
app.use('/turmas', autenticar, exigirPapel('ADMIN'), turmasRoutes)
app.use('/auth', authRoutes)
app.use('/associados', autenticar, associadosRoutes)
app.use('/usuarios', autenticar, exigirPapel('ADMIN'), usuariosRoutes)
app.use('/projetos', autenticar, exigirPapel('ADMIN'), projetosRoutes)
app.use('/matriculas', autenticar, exigirPapel('ADMIN'), matriculasRoutes)
app.use('/pagamentos', autenticar, exigirPapel('ADMIN'), pagamentosRoutes)

app.get('/', (req, res) => {
  res.json({ mensagem: 'API Conecta funcionando!' })
}) 

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`run: ${PORT}`)
}) 