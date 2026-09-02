import fs from 'fs'
import path from 'path'

export interface PermissionRow {
  permission: string
  label: string
  category: 'view' | 'edit' | 'analytics' | 'monitoring' | 'assignment' | 'admin'
  super_admin: boolean
  admin: boolean
  tutor: boolean
  student: boolean
}

const FILE_PATH = path.join(process.cwd(), 'permissions.json')

const DEFAULT_PERMISSIONS: PermissionRow[] = [
  { permission: 'view_tests', label: 'View Tests', category: 'view', super_admin: true, admin: true, tutor: true, student: true },
  { permission: 'preview_tests', label: 'Preview Tests Anytime', category: 'view', super_admin: true, admin: true, tutor: true, student: false },
  { permission: 'edit_tests', label: 'Create & Edit Tests', category: 'edit', super_admin: true, admin: true, tutor: false, student: false },
  { permission: 'delete_tests', label: 'Delete Tests', category: 'edit', super_admin: true, admin: false, tutor: false, student: false },
  { permission: 'assign_tests', label: 'Assign Tests to Students', category: 'assignment', super_admin: true, admin: true, tutor: true, student: false },
  { permission: 'view_analytics', label: 'View Deep Performance Analytics', category: 'analytics', super_admin: true, admin: true, tutor: true, student: false },
  { permission: 'view_monitoring', label: 'Access Live Cheating Monitoring', category: 'monitoring', super_admin: true, admin: true, tutor: false, student: false },
  { permission: 'manage_assignments', label: 'Manage Tutor Assignments', category: 'assignment', super_admin: true, admin: true, tutor: false, student: false },
  { permission: 'manage_session_logs', label: 'Manage Session Logs & Attendance', category: 'admin', super_admin: true, admin: false, tutor: true, student: false },
  { permission: 'teacher_salaries', label: 'Teacher Salaries & Payroll', category: 'admin', super_admin: true, admin: false, tutor: false, student: false },
  { permission: 'take_tests', label: 'Take Active Tests', category: 'view', super_admin: false, admin: false, tutor: false, student: true },
  { permission: 'view_results', label: 'View Own Results', category: 'view', super_admin: false, admin: false, tutor: false, student: true },
  { permission: 'manage_users', label: 'Manage All User Profiles', category: 'admin', super_admin: true, admin: false, tutor: false, student: false },
  { permission: 'platform_settings', label: 'Configure Platform Settings', category: 'admin', super_admin: true, admin: false, tutor: false, student: false },
]

export function getPermissions(): PermissionRow[] {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const data = fs.readFileSync(FILE_PATH, 'utf-8')
      const stored = JSON.parse(data) as PermissionRow[]
      // Merge with DEFAULT_PERMISSIONS in case new permissions were added
      const existingPermKeys = new Set(stored.map(p => p.permission))
      const missingDefaults = DEFAULT_PERMISSIONS.filter(d => !existingPermKeys.has(d.permission))
      if (missingDefaults.length > 0) {
        return [...stored, ...missingDefaults]
      }
      return stored
    }
  } catch (error) {
    console.error('Error reading permissions file, falling back to defaults:', error)
  }
  return DEFAULT_PERMISSIONS
}

export function savePermissions(permissions: PermissionRow[]): boolean {
  try {
    // Super Admins should always retain full access, force it for security
    const sanitized = permissions.map(p => {
      if (p.permission === 'manage_users' || p.permission === 'platform_settings' || p.permission === 'teacher_salaries' || p.permission === 'manage_session_logs') {
        return { ...p, super_admin: true }
      }
      return { ...p, super_admin: p.permission === 'take_tests' || p.permission === 'view_results' ? false : true }
    })
    fs.writeFileSync(FILE_PATH, JSON.stringify(sanitized, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Error writing permissions file:', error)
    return false
  }
}
