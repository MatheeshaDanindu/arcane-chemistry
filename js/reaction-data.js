const reactions = {
  vinegar_baking_soda: {
    key: 'vinegar_baking_soda',
    label: 'CO2 + H2O + Sodium Acetate',
    effect: 'fizz',
    color: 0x7ef0c5,
    tempChange: -2,
    description: 'A fizzy neutralization that bubbles and cools the potion.'
  },
  copper_sulfate_iron: {
    key: 'copper_sulfate_iron',
    label: 'Iron displaces copper',
    effect: 'displacement',
    color: 0xb87333,
    tempChange: 5,
    description: 'The iron precipitates copper, creating a warm bronze glow.'
  },
  hydrochloric_acid_sodium_hydroxide: {
    key: 'hydrochloric_acid_sodium_hydroxide',
    label: 'Neutralization reaction',
    effect: 'neutralize',
    color: 0xffffff,
    tempChange: 2,
    description: 'The acid/base mix settles into a neutralized solution.'
  },
  vinegar_sodium_hydroxide: {
    key: 'vinegar_sodium_hydroxide',
    label: 'Acid-base neutralization',
    effect: 'neutralize',
    color: 0xf4d35e,
    tempChange: 1,
    description: 'Partial neutralization creates a warm golden brew.'
  },
  copper_sulfate_sodium_hydroxide: {
    key: 'copper_sulfate_sodium_hydroxide',
    label: 'Precipitation reaction',
    effect: 'precipitate',
    color: 0x4cc9f0,
    tempChange: 3,
    description: 'A precipitate forms and the fluid turns a vivid cyan.'
  }
};

const ingredientDetails = {
  vinegar: { label: 'Vinegar', formula: 'CH3COOH', molarMass: '60.05 g/mol' },
  baking_soda: { label: 'Baking Soda', formula: 'NaHCO3', molarMass: '84.01 g/mol' },
  copper_sulfate: { label: 'Copper Sulfate', formula: 'CuSO4', molarMass: '159.61 g/mol' },
  iron: { label: 'Iron', formula: 'Fe', molarMass: '55.85 g/mol' },
  hydrochloric_acid: { label: 'Hydrochloric Acid', formula: 'HCl', molarMass: '36.46 g/mol' },
  sodium_hydroxide: { label: 'Sodium Hydroxide', formula: 'NaOH', molarMass: '40.00 g/mol' }
};

function normalizeIngredients(ingredientA, ingredientB) {
  const cleanA = String(ingredientA || '').trim();
  const cleanB = String(ingredientB || '').trim();
  return [cleanA, cleanB].sort().join('_');
}

function getReaction(ingredientA, ingredientB) {
  const key = normalizeIngredients(ingredientA, ingredientB);
  return reactions[key] || {
    key,
    label: 'No reaction',
    effect: 'none',
    color: 0x888888,
    tempChange: 0,
    description: 'These ingredients do not react in a useful way.'
  };
}

async function fetchCompoundInfo(name) {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/MolecularFormula,IUPACName,pH/JSON`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const record = data?.PropertyTable?.Properties?.[0];
    if (!record) {
      return null;
    }

    return {
      name,
      formula: record.MolecularFormula || 'Unknown',
      iupacName: record.IUPACName || 'Unknown compound',
      ph: record.pH ?? null
    };
  } catch (error) {
    console.warn(`PubChem lookup failed for ${name}:`, error);
    return null;
  }
}

async function getReactionDetails(ingredientA, ingredientB) {
  const reaction = getReaction(ingredientA, ingredientB);
  const primary = ingredientDetails[ingredientA] || { label: ingredientA };
  const secondary = ingredientDetails[ingredientB] || { label: ingredientB };

  const [firstInfo, secondInfo] = await Promise.all([
    fetchCompoundInfo(primary.label),
    fetchCompoundInfo(secondary.label)
  ]);

  return {
    reaction,
    first: firstInfo || primary,
    second: secondInfo || secondary,
    fallback: !firstInfo || !secondInfo
  };
}

window.ArcaneChemistry = window.ArcaneChemistry || {};
window.ArcaneChemistry.reactions = reactions;
window.ArcaneChemistry.ingredientDetails = ingredientDetails;
window.ArcaneChemistry.getReaction = getReaction;
window.ArcaneChemistry.getReactionDetails = getReactionDetails;
