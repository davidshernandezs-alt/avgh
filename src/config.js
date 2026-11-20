// Configuración general de la app AVGH.
// COMPLETA aquí los enlaces a las redes sociales cuando los tengas.

export const SITE_NAME = 'AVGH'

export const CURRENCY = '$'

// Correo de la cuenta de administración (se crea con scripts/create-admin.mjs).
// Solo el perfil cuyo rol sea "admin" puede entrar al panel de administración.
export const ADMIN_EMAIL = 'informacion@avgh.org.ve'

// Enlaces de redes sociales (poner la URL completa, p. ej. 'https://www.linkedin.com/company/avgh')
export const SOCIAL = {
  linkedin: '',
  instagram: 'https://www.instagram.com/avgh.rrhh',
  facebook: 'https://www.facebook.com/groups/15033432013/',
  x: 'https://x.com/AVGH_RRHH',
  youtube: 'https://www.youtube.com/@avghrrhh',
  whatsapp: ''
}

export const CONTACT = {
  email: '',
  phone: ''
}

// Devuelve la ruta correcta de un recurso de la carpeta public/ (funciona
// tanto en desarrollo como en hosting en subcarpeta).
export const asset = (name) => `${import.meta.env.BASE_URL}${name}`