import { clinic } from "@/components/clinic";

/** Topic groups, in the order the FAQ page shows them. */
export const FAQ_GROUPS = [
  "Opening hours and booking",
  "Services",
  "Costs and insurance",
  "Before your visit",
  "Aftercare",
] as const;

export type FaqGroup = (typeof FAQ_GROUPS)[number];

/**
 * `group` is used only by the FAQ page to arrange the accordion.
 * `retrieve` ignores it.
 */
export type FaqEntry = {
  id: string;
  group: FaqGroup;
  question: string;
  answer: string;
  keywords: string[];
};

/**
 * Fictional demo content. Copy rules (see CLAUDE.md): no medical, safety or
 * outcome claims and no invented numbers. Keywords are single lower-case words
 * (synonyms included); `retrieve` treats a trailing plural "s" as the same word.
 */
export const FAQ: FaqEntry[] = [
  // Opening hours and booking
  {
    id: "hours",
    group: "Opening hours and booking",
    question: "What are your opening hours?",
    answer: `Our fictional clinic is open ${clinic.hoursSummary}`,
    keywords: ["hours", "open", "opening", "time", "weekend", "closed"],
  },
  {
    id: "booking",
    group: "Opening hours and booking",
    question: "How do I book an appointment?",
    answer: "Use the contact page. In this demo the form does not send anything.",
    keywords: ["book", "booking", "appointment", "reserve", "slot"],
  },
  {
    id: "reschedule",
    group: "Opening hours and booking",
    question: "Can I change or cancel an appointment?",
    answer:
      "Nothing is booked in this demo. At a real clinic you would contact the team as early as you can to move or cancel a visit.",
    keywords: ["cancel", "change", "reschedule", "move", "postpone"],
  },
  {
    id: "location",
    group: "Opening hours and booking",
    question: "Where is the clinic?",
    answer:
      "The address of our fictional clinic is on the contact page. It is a demo, so there is no real location.",
    keywords: ["address", "location", "directions", "located", "map"],
  },
  {
    id: "contact",
    group: "Opening hours and booking",
    question: "How can I contact the team?",
    answer:
      "The contact page lists the phone number and email of our fictional clinic. In this demo nobody will answer.",
    keywords: ["contact", "phone", "call", "email", "number"],
  },

  // Services
  {
    id: "services",
    group: "Services",
    question: "Which services do you offer?",
    answer:
      "Check-ups, cleaning, fillings, whitening, root canal treatment, crowns and bridges, and children's dentistry.",
    keywords: ["services", "offer", "treatment", "procedure", "provide"],
  },
  {
    id: "children",
    group: "Services",
    question: "Do you treat children?",
    answer: "Yes, our fictional clinic offers children's dentistry.",
    keywords: ["children", "child", "kid", "pediatric", "paediatric"],
  },
  {
    id: "cleaning",
    group: "Services",
    question: "Do you offer teeth cleaning?",
    answer:
      "Yes, cleaning is one of the services our fictional clinic lists. The team can explain what a cleaning visit involves.",
    keywords: ["cleaning", "clean", "scale", "polish", "hygiene"],
  },
  {
    id: "whitening",
    group: "Services",
    question: "Do you offer teeth whitening?",
    answer:
      "Yes, whitening is one of the services our fictional clinic lists. Ask the team what it involves.",
    keywords: ["whitening", "whiten", "bleaching", "brighten", "shade"],
  },
  {
    id: "fillings",
    group: "Services",
    question: "Do you do fillings?",
    answer:
      "Yes, fillings are one of the services our fictional clinic lists. Your dentist explains the steps during the visit.",
    keywords: ["filling", "cavity", "restoration", "repair"],
  },
  {
    id: "root-canal",
    group: "Services",
    question: "Do you offer root canal treatment?",
    answer:
      "Yes, root canal treatment is one of the services our fictional clinic lists. Your dentist explains the steps during the visit.",
    keywords: ["root", "canal", "endodontic", "nerve"],
  },
  {
    id: "crowns",
    group: "Services",
    question: "Do you offer crowns and bridges?",
    answer:
      "Yes, crowns and bridges are listed among the services of our fictional clinic. Ask the team what they involve.",
    keywords: ["crown", "bridge", "cap", "prosthetic"],
  },

  // Costs and insurance
  {
    id: "pricing",
    group: "Costs and insurance",
    question: "How much does a check-up cost?",
    answer:
      "Demo note: prices here are made up. In a real clinic, the dentist would give you a written estimate before treatment.",
    keywords: ["price", "cost", "fee", "much", "charge", "rate"],
  },
  {
    id: "insurance",
    group: "Costs and insurance",
    question: "Do you accept dental insurance?",
    answer:
      "Demo note: this is a fictional answer. Many clinics work with insurers, so ask your provider what they cover.",
    keywords: ["insurance", "insurer", "cover", "coverage", "claim"],
  },
  {
    id: "payment",
    group: "Costs and insurance",
    question: "How can I pay?",
    answer:
      "Demo note: no payments are taken here. A real clinic would explain the payment options before treatment.",
    keywords: ["pay", "payment", "card", "cash", "bill"],
  },

  // Before your visit
  {
    id: "first-visit",
    group: "Before your visit",
    question: "What happens at a first visit?",
    answer:
      "A first visit usually starts with a conversation about your needs and a look at your teeth. The dentist explains each step.",
    keywords: ["first", "visit", "new", "patient", "expect"],
  },
  {
    id: "bring",
    group: "Before your visit",
    question: "What should I bring?",
    answer:
      "Bring a photo ID, a list of your medicines, and any recent dental records you have.",
    keywords: ["bring", "documents", "id", "records", "medicine"],
  },
  {
    id: "nervous",
    group: "Before your visit",
    question: "What if I feel nervous about the visit?",
    answer:
      "Tell the team when you book or when you arrive. They can explain each step and pause when you ask.",
    keywords: ["nervous", "anxious", "anxiety", "scared", "afraid", "fear"],
  },

  // Aftercare
  {
    id: "aftercare",
    group: "Aftercare",
    question: "What should I do after a filling?",
    answer:
      "Your dentist will explain what to do after a filling for your own situation. Contact your dentist if something does not feel right.",
    keywords: ["aftercare", "after", "filling", "recovery", "instructions"],
  },
  {
    id: "after-treatment",
    group: "Aftercare",
    question: "When should I contact the clinic after treatment?",
    answer:
      "Get in touch if pain gets worse, if you notice swelling, or if something does not feel right. In an emergency, call your local emergency number.",
    keywords: ["after", "treatment", "swelling", "worse", "problem"],
  },
  {
    id: "emergency",
    group: "Aftercare",
    question: "What should I do in a dental emergency?",
    answer:
      "In an emergency, call your local emergency number. This demo clinic cannot take real calls or bookings.",
    keywords: ["emergency", "urgent", "toothache", "pain", "accident"],
  },
];
