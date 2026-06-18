// Generates a short, human-friendly join code for a party room.
// Uppercase letters only (no digits) to avoid 0/O, 1/I confusion when typing.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generatePartyCode(length = 4): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
