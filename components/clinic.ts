/** Fictional clinic details. Single source for Home, Contact and Footer. */
export const clinic = {
  name: "Northwind Dental",
  address: "100 Example Street, Sampletown",
  phone: "555-0100",
  email: "hello@example.com",
  hours: [
    { days: "Monday to Friday", time: "9:00 to 17:00" },
    { days: "Saturday and Sunday", time: "Closed" },
  ],
  /** One-line form. The FAQ "opening hours" answer must say the same thing. */
  hoursSummary: "Monday to Friday, 9:00 to 17:00. Closed on weekends.",
} as const;
