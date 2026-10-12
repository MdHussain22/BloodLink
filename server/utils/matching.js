// Preliminary ABO/Rh red-cell donor filter only. Clinical crossmatching remains mandatory.
const compatibleDonors = {
  "O-": ["O-"], "O+": ["O-", "O+"],
  "A-": ["O-", "A-"], "A+": ["O-", "O+", "A-", "A+"],
  "B-": ["O-", "B-"], "B+": ["O-", "O+", "B-", "B+"],
  "AB-": ["O-", "A-", "B-", "AB-"],
  "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]
};
export function donorGroupsFor(group) { return compatibleDonors[group] || []; }
export function cooldownDate() {
  const date = new Date();
  date.setDate(date.getDate() - Number(process.env.DONATION_COOLDOWN_DAYS || 90));
  return date;
}
