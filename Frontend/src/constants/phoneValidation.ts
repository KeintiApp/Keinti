// Rango de longitud de números telefónicos por prefijo
interface PhoneLengthRange {
  min: number;
  max: number;
}

const PHONE_LENGTH_RANGES: { [prefix: string]: PhoneLengthRange } = {
  '+34': { min: 9, max: 9 },      // España
  '+52': { min: 10, max: 10 },    // México
  '+54': { min: 10, max: 10 },    // Argentina
  '+57': { min: 10, max: 10 },    // Colombia
  '+56': { min: 9, max: 9 },      // Chile
  '+51': { min: 9, max: 9 },      // Perú
  '+58': { min: 10, max: 10 },    // Venezuela
  '+593': { min: 9, max: 9 },     // Ecuador
  '+502': { min: 8, max: 8 },     // Guatemala
  '+53': { min: 8, max: 8 },      // Cuba
  '+591': { min: 8, max: 8 },     // Bolivia
  '+1-809': { min: 10, max: 10 }, // República Dominicana
  '+504': { min: 8, max: 8 },     // Honduras
  '+595': { min: 9, max: 9 },     // Paraguay
  '+503': { min: 8, max: 8 },     // El Salvador
  '+505': { min: 8, max: 8 },     // Nicaragua
  '+506': { min: 8, max: 8 },     // Costa Rica
  '+507': { min: 8, max: 8 },     // Panamá
  '+598': { min: 8, max: 9 },     // Uruguay
  '+1-787': { min: 10, max: 10 }, // Puerto Rico
};

export function getPhoneLengthRange(prefix: string): PhoneLengthRange {
  return PHONE_LENGTH_RANGES[prefix] || { min: 8, max: 15 };
}
