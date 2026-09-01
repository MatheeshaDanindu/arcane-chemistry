document.addEventListener('DOMContentLoaded', () => {
  const ingredientButtons = Array.from(document.querySelectorAll('.ingredient-btn'));
  const statusEl = document.getElementById('reaction-status');

  if (!ingredientButtons.length || !statusEl) {
    return;
  }

  let selectedIngredients = [];

  const updateStatus = (message) => {
    statusEl.textContent = message;
  };

  ingredientButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const ingredient = button.dataset.ingredient;
      if (!ingredient) return;

      if (selectedIngredients.includes(ingredient)) {
        selectedIngredients = selectedIngredients.filter((name) => name !== ingredient);
        button.classList.remove('selected');
        updateStatus('Selection cleared. Choose a catalyst or reagent to continue.');
        return;
      }

      if (selectedIngredients.length >= 2) {
        const firstButton = ingredientButtons.find((item) => item.dataset.ingredient === selectedIngredients[0]);
        if (firstButton) firstButton.classList.remove('selected');
        selectedIngredients = [];
      }

      selectedIngredients.push(ingredient);
      button.classList.add('selected');

      if (selectedIngredients.length === 2) {
        const [first, second] = selectedIngredients;
        const reaction = window.ArcaneChemistry?.getReaction(first, second);
        updateStatus(`${reaction.label} — ${reaction.description}`);
      } else {
        updateStatus(`Ingredient selected: ${ingredient}. Choose a second reagent.`);
      }
    });
  });
});
