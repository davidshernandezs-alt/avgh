// Semilla de datos demo AVGH -> Realtime Database (nodo "avgh/actividades")
// Ejecutar una sola vez:  node scripts/seed.mjs
import { initializeApp } from 'firebase/app'
import { getDatabase, set, ref } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyDjYv5Ykna1SqhUtbjn2FAnFNeNg371kaE',
  authDomain: 'avgh-af453.firebaseapp.com',
  projectId: 'avgh-af453',
  storageBucket: 'avgh-af453.firebasestorage.app',
  messagingSenderId: '417342855364',
  appId: '1:417342855364:web:2721aa915c74a90bb15191',
  measurementId: 'G-0LSTZH0C4T',
  databaseURL: 'https://avgh-af453-default-rtdb.firebaseio.com'
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

const now = Date.now()
const DAY = 24 * 60 * 60 * 1000
const inDays = (n) => now + n * DAY

const actividades = {
  'curso-001': {
    tipo: 'course',
    titulo: {
      es: 'Excel Avanzado para el Trabajo',
      en: 'Advanced Excel for Work'
    },
    descripcion: {
      es: 'Domina tablas dinámicas, fórmulas avanzadas, Power Query y automatización con macros. Un programa práctico para elevar tu productividad en el ámbito laboral.',
      en: 'Master pivot tables, advanced formulas, Power Query and automation with macros. A practical program to boost your productivity at work.'
    },
    modalidad: 'online',
    duracion: '8 semanas',
    horario: 'Lun y Mié · 7:00 p. m. a 8:30 p. m.',
    fechaInicio: inDays(10),
    fechaFin: inDays(10 + 54),
    instructor: 'Lic. María Fernández',
    cupo: 30,
    precio: 120
  },
  'curso-002': {
    tipo: 'course',
    titulo: {
      es: 'Liderazgo y Gestión de Equipos',
      en: 'Leadership and Team Management'
    },
    descripcion: {
      es: 'Herramientas para dirigir equipos de alto rendimiento: comunicación asertiva, motivación, delegación y resolución de conflictos.',
      en: 'Tools to lead high-performance teams: assertive communication, motivation, delegation and conflict resolution.'
    },
    modalidad: 'hybrid',
    duracion: '6 semanas',
    horario: 'Sábados · 9:00 a. m. a 12:00 p. m.',
    fechaInicio: inDays(15),
    fechaFin: inDays(15 + 40),
    instructor: 'Dr. Andrés Castillo',
    cupo: 25,
    precio: 150
  },
  'curso-003': {
    tipo: 'course',
    titulo: {
      es: 'Marketing Digital y Redes Sociales',
      en: 'Digital Marketing and Social Media'
    },
    descripcion: {
      es: 'Aprende a crear estrategias de contenido, campañas en redes sociales, posicionamiento orgánico y publicidad digital desde cero.',
      en: 'Learn to build content strategies, social media campaigns, organic positioning and digital advertising from scratch.'
    },
    modalidad: 'online',
    duracion: '10 semanas',
    horario: 'Mar y Jue · 6:00 p. m. a 7:30 p. m.',
    fechaInicio: inDays(20),
    fechaFin: inDays(20 + 68),
    instructor: 'Sra. Carolina Méndez',
    cupo: 40,
    precio: 180
  },
  'taller-001': {
    tipo: 'workshop',
    titulo: {
      es: 'Taller de Finanzas Personales',
      en: 'Personal Finance Workshop'
    },
    descripcion: {
      es: 'Aprende a ordenar tus ingresos, crear un presupuesto, ahorrar e invertir de forma simple y sin tecnicismos.',
      en: 'Learn to organize your income, build a budget, save and invest simply and without jargon.'
    },
    modalidad: 'inPerson',
    duracion: '2 sesiones · 4 horas',
    horario: 'Sábado · 9:00 a. m. a 1:00 p. m.',
    fechaInicio: inDays(6),
    fechaFin: inDays(6 + 7),
    instructor: 'Economista Luis Rojas',
    cupo: 20,
    precio: 45
  },
  'taller-002': {
    tipo: 'workshop',
    titulo: {
      es: 'Taller de Oratoria y Comunicación',
      en: 'Public Speaking Workshop'
    },
    descripcion: {
      es: 'Vence el miedo escénico, estructura discursos claros y comunica tus ideas con seguridad ante cualquier audiencia.',
      en: 'Overcome stage fright, structure clear speeches and communicate your ideas confidently to any audience.'
    },
    modalidad: 'inPerson',
    duracion: '1 sesión · 3 horas',
    horario: 'Viernes · 4:00 p. m. a 7:00 p. m.',
    fechaInicio: inDays(4),
    fechaFin: inDays(4),
    instructor: 'Prof. Gabriela Salazar',
    cupo: 18,
    precio: 30
  },
  'taller-003': {
    tipo: 'workshop',
    titulo: {
      es: 'Taller: Inteligencia Artificial para el Empleo',
      en: 'Workshop: AI for Employment'
    },
    descripcion: {
      es: 'Aplicaciones prácticas de IA para optimizar tu CV, preparar entrevistas y automatizar tareas profesionales diarias.',
      en: 'Practical AI applications to optimize your CV, prepare for interviews and automate everyday professional tasks.'
    },
    modalidad: 'online',
    duracion: '3 sesiones · 6 horas',
    horario: 'Lun, Mié y Vie · 6:30 p. m. a 8:30 p. m.',
    fechaInicio: inDays(8),
    fechaFin: inDays(8 + 6),
    instructor: 'Ing. Ricardo Prado',
    cupo: 35,
    precio: 60
  },
  'evento-001': {
    tipo: 'event',
    titulo: {
      es: 'Gran Encuentro Anual AVGH',
      en: 'AVGH Annual Gathering'
    },
    descripcion: {
      es: 'Un espacio de encuentro, networking y conferencias con invitados especiales para celebrar el crecimiento de nuestra comunidad.',
      en: 'A space for networking, conferences and special guests to celebrate the growth of our community.'
    },
    modalidad: 'inPerson',
    duracion: '1 día',
    horario: '9:00 a. m. a 5:00 p. m.',
    fechaInicio: inDays(30),
    fechaFin: inDays(30),
    instructor: '',
    cupo: 150,
    precio: 0
  },
  'evento-002': {
    tipo: 'event',
    titulo: {
      es: 'Webinar: Tendencias del Mercado Laboral 2026',
      en: 'Webinar: 2026 Labor Market Trends'
    },
    descripcion: {
      es: 'Conversatorio virtual sobre las profesiones más demandadas, habilidades del futuro y cómo posicionarte profesionalmente.',
      en: 'Virtual talk about the most in-demand professions, future skills and how to position yourself professionally.'
    },
    modalidad: 'online',
    duracion: '1 hora y media',
    horario: '6:00 p. m. a 7:30 p. m.',
    fechaInicio: inDays(12),
    fechaFin: inDays(12),
    instructor: '',
    cupo: 200,
    precio: 0
  }
}

const root = ref(db, 'avgh/actividades')

const result = await set(root, actividades)
console.log('✅ Datos de ejemplo escritos en avgh/actividades')
process.exit(0)