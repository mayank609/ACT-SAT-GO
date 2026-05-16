'use server'

import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { revalidatePath } from 'next/cache'

/**
 * Syncs a Supabase Auth user with our Prisma Database.
 */
export async function syncUser(id: string, email: string, role: Role = 'STUDENT') {
  try {
    const user = await prisma.user.upsert({
      where: { id },
      update: { email }, // We don't overwrite role on sync unless specified
      create: { id, email, role },
    })
    return { success: true, user }
  } catch (error) {
    console.error('Error syncing user:', error)
    return { success: false, error: 'Failed to sync user data' }
  }
}

/**
 * Assigns a student to a tutor.
 */
export async function assignStudentToTutor(tutorId: string, studentId: string) {
  try {
    const assignment = await prisma.tutorAssignment.create({
      data: { tutorId, studentId },
    })
    revalidatePath('/admin/users')
    return { success: true, assignment }
  } catch (error) {
    console.error('Error assigning student:', error)
    return { success: false, error: 'Failed to assign student' }
  }
}

/**
 * Fetches all students assigned to a specific tutor.
 */
export async function getTutorStudents(tutorId: string) {
  try {
    const assignments = await prisma.tutorAssignment.findMany({
      where: { tutorId },
      include: {
        student: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          }
        },
      },
    })
    return { success: true, students: assignments.map(a => a.student) }
  } catch (error) {
    console.error('Error fetching tutor students:', error)
    return { success: false, error: 'Failed to fetch students' }
  }
}

/**
 * Fetches all users by role.
 */
export async function getUsersByRole(role: Role) {
  try {
    const users = await prisma.user.findMany({
      where: { role },
      orderBy: { createdAt: 'desc' }
    })
    return { success: true, users }
  } catch (error) {
    console.error('Error fetching users:', error)
    return { success: false, error: 'Failed to fetch users' }
  }
}
