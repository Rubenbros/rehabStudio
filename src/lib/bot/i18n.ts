export type Lang = "es" | "en";

/**
 * Naive language detector for the first message. Once a patient is created we
 * persist the choice in `patients.language`.
 */
export function detectLang(text: string): Lang {
  const t = text.toLowerCase();
  const enHints = [
    " the ",
    " i ",
    " you ",
    " hello",
    " hi ",
    "appointment",
    "booking",
    "tomorrow",
    "today",
    "thanks",
    "thank you",
  ];
  if (enHints.some((h) => ` ${t} `.includes(h))) return "en";
  return "es";
}

export const T = {
  welcome: {
    es: (clinic: string) =>
      `¡Hola! Soy el asistente de ${clinic} 🌿\nPuedo ayudarte a reservar, cambiar o cancelar tu cita. ¿En qué te ayudo?`,
    en: (clinic: string) =>
      `Hi! I'm ${clinic}'s assistant 🌿\nI can help you book, reschedule or cancel an appointment. How can I help?`,
  },
  askName: {
    es: "Para empezar, ¿me dices tu nombre completo?",
    en: "To get started, could you tell me your full name?",
  },
  askEmail: {
    es: "Gracias. ¿Cuál es tu email? (lo usamos para enviarte la invitación al calendario)",
    en: "Thanks. What's your email? (we use it to send the calendar invite)",
  },
  askReason: {
    es: "Opcional: ¿quieres contarme brevemente el motivo de la consulta? Si prefieres no decirlo, escribe «saltar».",
    en: "Optional: would you like to briefly share the reason? Type 'skip' if you'd rather not.",
  },
  onboardingDone: {
    es: "¡Perfecto! Ya estás registrado. Dime cuándo te vendría bien la cita.",
    en: "All set! Tell me when would work for you.",
  },
  bookingConfirmed: {
    es: (when: string, price: number, address: string) =>
      `✅ Cita confirmada para ${when}.\n💶 ${price}€ (cobro presencial).\n📍 ${address}\n\nTe enviaré recordatorio 24h y 2h antes.`,
    en: (when: string, price: number, address: string) =>
      `✅ Appointment confirmed for ${when}.\n💶 ${price}€ (paid in person).\n📍 ${address}\n\nI'll remind you 24h and 2h before.`,
  },
  reminder24: {
    es: (when: string) =>
      `Recordatorio: tu cita es mañana, ${when}. Responde SÍ para confirmar o NO para cancelar.`,
    en: (when: string) =>
      `Reminder: your appointment is tomorrow at ${when}. Reply YES to confirm or NO to cancel.`,
  },
  reminder2: {
    es: (when: string) => `⏰ Te esperamos hoy a las ${when}. ¡Hasta ahora!`,
    en: (when: string) => `⏰ See you today at ${when}!`,
  },
  followup: {
    es: "¿Qué tal te encuentras tras la sesión? Si necesitas seguimiento (30 min, 30€) dime y te busco hueco.",
    en: "How are you feeling after the session? If you need a follow-up (30 min, 30€) let me know and I'll find a slot.",
  },
  notUnderstood: {
    es: "No te he entendido del todo. ¿Puedes reformularlo?",
    en: "I didn't quite get that. Could you rephrase?",
  },
  cancelled: {
    es: "Cita cancelada. Cuando quieras volver a reservar, aquí estoy.",
    en: "Appointment cancelled. Whenever you want to book again, I'm here.",
  },
} as const;
