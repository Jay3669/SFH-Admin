const unitGroups = [
  {
    units: ["kg", "g", "mg", "lb", "oz"],
    aliases: ["kg", "kgs", "kilogram", "kilograms", "g", "gm", "gms", "grm", "grms", "gram", "grams", "gramme", "grammes", "mg", "lb", "lbs", "oz"],
  },
  {
    units: ["L", "ml", "cc"],
    aliases: ["l", "lt", "ltr", "ltrs", "liter", "liters", "litre", "litres", "ml", "milliliter", "milliliters", "millilitre", "millilitres", "cc"],
  },
  {
    units: ["pcs", "dozen"],
    aliases: ["piece", "pieces", "pc", "pcs", "each", "dz", "dozen"],
  },
];

export function recipeUnitsForStockUnit(stockUnit) {
  if (!stockUnit) return [];
  const normalized = String(stockUnit).trim().toLowerCase();
  const group = unitGroups.find((candidate) => candidate.aliases.includes(normalized));
  return group ? [...new Set([stockUnit, ...group.units])] : [stockUnit];
}