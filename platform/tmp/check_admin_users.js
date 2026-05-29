(async ()=>{
  try{
    const { prisma } = require('../src/lib/prisma')
    const users = await prisma.user.findMany({ where: { role: 'ADMIN' }, include: { tutors: true, students: true, attempts: true } })
    console.log('users', users.length)
    process.exit(0)
  }catch(e){
    console.error('ERR', e)
    process.exit(1)
  }
})()
