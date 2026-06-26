require('dotenv').config()
const prisma = require('./db')
const bcrypt = require('bcryptjs')

async function main() {
  const senhaCriptografada = await bcrypt.hash('admin123', 10)

  const admin = await prisma.usuario.create({
    data: {
      nome: 'Administrador',
      cpf: '00000000000',
      email: 'admin@conecta.com',
      senha: senhaCriptografada,
      papel: 'ADMIN'
    }
  })

  console.log('Admin criado:', admin)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())