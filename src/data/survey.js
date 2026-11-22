// Encuesta de satisfacción (basada en la evaluación de reacción de la AVGH).
// Todas las preguntas son obligatorias. La escala es 1 (bajo) a 4 (alto).
export const SURVEY_QUESTIONS = [
  {
    id: 'alineacion',
    section: 'Contenido del evento',
    text: '¿Considera que los contenidos del evento estuvieron alineados con los objetivos planteados?',
    options: [
      'No estuvieron alineados',
      'Estuvieron parcialmente alineados',
      'Estuvieron alineados',
      'Estuvieron completamente alineados'
    ]
  },
  {
    id: 'expectativas',
    text: '¿En qué medida el evento cumplió con sus expectativas?',
    options: ['No cumplió en absoluto', 'Cumplió parcialmente', 'Cumplió en su mayoría', 'Superó mis expectativas']
  },
  {
    id: 'profundidad',
    text: '¿El nivel de profundidad de los contenidos ha sido adecuado?',
    options: ['Demasiado superficial', 'Poco profundo', 'Adecuado', 'Muy profundo']
  },
  {
    id: 'estructura',
    text: '¿El evento estuvo estructurado de modo claro y comprensible?',
    options: ['Nada claro', 'Poco claro', 'Claro', 'Muy claro']
  },
  {
    id: 'duracion',
    text: '¿La duración del evento ha sido adecuada?',
    options: ['Demasiado corta', 'Adecuada', 'Larga, pero tolerable', 'Demasiado larga']
  },
  {
    id: 'utilidad',
    section: 'Utilidad y aplicabilidad',
    text: '¿Los contenidos le serán útiles y aplicables en su trabajo?',
    options: ['Nada útiles', 'Poco útiles', 'Útiles', 'Muy útiles y aplicables']
  },
  {
    id: 'facilitador_dominio',
    section: 'Evaluación del facilitador',
    text: '¿El facilitador demostró dominio y conocimiento de la materia?',
    options: [
      'No demostró dominio ni conocimiento',
      'Demostró poco dominio y conocimiento',
      'Demostró dominio y conocimiento adecuado',
      'Demostró completo dominio y conocimiento'
    ]
  },
  {
    id: 'facilitador_claridad',
    text: '¿El facilitador explicó con claridad y respondió las inquietudes?',
    options: [
      'No explicó con claridad ni respondió efectivamente',
      'Explicó con algo de claridad y respondió parcialmente',
      'Explicó con claridad y respondió adecuadamente',
      'Explicó con total claridad y respondió de manera excelente'
    ]
  },
  {
    id: 'aporte_conocimiento',
    text: '¿El evento le aportó conocimientos nuevos?',
    options: [
      'No, no aportó conocimientos nuevos',
      'Poco, solo algunos conceptos nuevos',
      'Sí, aportó varios conocimientos nuevos',
      'Sí, aportó muchos conocimientos nuevos'
    ]
  },
  {
    id: 'duracion_exposicion',
    text: '¿Considera que la duración de la exposición fue adecuada para profundizar el tema?',
    options: ['Insuficiente', 'Regular', 'Adecuada', 'Excesiva']
  },
  {
    id: 'calificacion_general',
    section: 'Evaluación general',
    text: '¿Cómo calificaría la actividad en general?',
    options: ['Mala', 'Regular', 'Buena', 'Excelente']
  }
]

export const SURVEY_OPEN_QUESTIONS = [
  {
    id: 'mejoras',
    text: 'Señale qué acciones deben considerarse para mejorar esta actividad:'
  },
  {
    id: 'temas_futuros',
    text: 'Desarrolle su idea de otros temas a abordar en futuros eventos de la AVGH:'
  }
]

export const surveyIntro =
  'Esta evaluación de reacción mide la percepción y satisfacción de los participantes respecto al evento: contenidos, metodología, calidad de los facilitadores y otros aspectos clave. Nos permite identificar aciertos y oportunidades de mejora para futuras ediciones.'
