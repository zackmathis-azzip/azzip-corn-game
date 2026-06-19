/** Playful messages shown when a guest clicks a green husk kernel. */
const HUSK_MESSAGES = [
  "Hands off the husk! 🌽",
  "Need something to click? Start an order at order.azzippizza.com 🌽",
  "Did you know corn fields are good listeners? We're all ears! 🌽",
  "When I grow up, I hope they use me on an elote pizza. Corn cobs can have dreams too! 🌽",
  "Want more prizes? Use (or join) Creator Rewards and earn points on each purchase. Points turn into prize boxes which turn into rewards you can use in-store and online. Join at rewards.azzippizza.com 🌽",
  "You found the secret message! 🌽",
  "You're a-maize-ing! 🌽",
];

/** Only offered while the guest can still pick a kernel. */
const PICK_KERNEL_MESSAGE = "Click a kernel, Colonel! 🌽";

export function randomHuskMessage(canStillPickKernel: boolean): string {
  const pool = canStillPickKernel ? [PICK_KERNEL_MESSAGE, ...HUSK_MESSAGES] : HUSK_MESSAGES;
  return pool[Math.floor(Math.random() * pool.length)];
}
