// Éléments du DOM
const textInput = document.getElementById("text-input");
const analyzeBtn = document.getElementById("analyze-btn");
const resultsContainer = document.getElementById("results");
const resultCard = document.querySelector(".result-card");
const scoreValue = document.querySelector(".score-value");
const sentimentType = document.getElementById("sentiment-type");
const meterFill = document.querySelector(".meter-fill");
const confidenceValue = document.getElementById("confidence-value");
const confidenceFill = document.querySelector(".confidence-fill");
const wordsCount = document.getElementById("words-count");
const expressionsCount = document.getElementById("expressions-count");
const modifiersCount = document.getElementById("modifiers-count");
const wordChips = document.getElementById("word-chips");
const expressionsList = document.getElementById("expressions-list");
const modifiersList = document.getElementById("modifiers-list");

// Boutons d'exemples
const exampleButtons = document.querySelectorAll(".example-btn");
exampleButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    textInput.value = btn.textContent;
    analyzeText();
  });
});

// Boutons de détails
document
  .getElementById("toggle-words")
  ?.addEventListener("click", toggleDetails);
document
  .getElementById("toggle-expressions")
  ?.addEventListener("click", toggleDetails);
document
  .getElementById("toggle-modifiers")
  ?.addEventListener("click", toggleDetails);

// Fonction d'analyse du texte
async function analyzeText() {
  const text = textInput.value.trim();

  if (!text) {
    alert("Veuillez entrer un texte à analyser.");
    return;
  }

  try {
    console.log("Envoi du texte pour analyse:", text);

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Erreur du serveur:", errorData);
      throw new Error(
        "Erreur lors de l'analyse: " + (errorData.details || "Erreur inconnue")
      );
    }

    const data = await response.json();
    console.log("Résultat de l'analyse:", data);

    // Affichage des résultats
    displayResults(data.result);
  } catch (error) {
    console.error("Erreur:", error);
    alert(
      "Une erreur s'est produite lors de l'analyse du texte: " + error.message
    );
  }
}

// Fonction pour afficher les résultats
function displayResults(result) {
  // Affichage du score principal
  scoreValue.textContent = result.score;
  sentimentType.textContent = result.sentiment;
  confidenceValue.textContent = `${Math.round(result.confidence * 100)}%`;
  confidenceFill.style.width = `${result.confidence * 100}%`;

  // Mise à jour de la barre de score
  meterFill.style.width = `${result.score * 100}%`;

  // Mise à jour des compteurs
  wordsCount.textContent = result.details.words.length;
  expressionsCount.textContent = result.details.idioms.length;
  modifiersCount.textContent = result.details.modifiers.length;

  // Mise à jour de la couleur du résultat
  resultCard.classList.remove("positive", "negative");
  if (result.score >= 0.55) {
    resultCard.classList.add("positive");
  } else if (result.score <= 0.45) {
    resultCard.classList.add("negative");
  }

  // Affichage des mots identifiés
  wordChips.innerHTML = "";
  result.details.words.forEach((item) => {
    const chip = document.createElement("div");
    chip.classList.add("word-chip");

    if (item.modifiedScore >= 0.6) {
      chip.classList.add("positive");
    } else if (item.modifiedScore <= 0.4) {
      chip.classList.add("negative");
    } else {
      chip.classList.add("neutral");
    }

    chip.textContent = `${item.word}: ${item.modifiedScore.toFixed(2)}`;
    wordChips.appendChild(chip);
  });

  // Affichage des expressions idiomatiques
  expressionsList.innerHTML = "";
  if (result.details.idioms.length > 0) {
    const list = document.createElement("ul");
    result.details.idioms.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = `"${item.phrase}": ${item.score}`;
      list.appendChild(li);
    });
    expressionsList.appendChild(list);
  } else {
    expressionsList.textContent = "Aucune expression idiomatique détectée.";
  }

  // Affichage des modificateurs
  modifiersList.innerHTML = "";
  if (result.details.modifiers.length > 0) {
    const list = document.createElement("ul");
    result.details.modifiers.forEach((item) => {
      const li = document.createElement("li");

      // Vérifier si l'élément a un target et un facteur de modification
      if (item.target && item.modification !== undefined) {
        const modType = item.modification < 0 ? "inverse" : "intensifie";
        li.textContent = `"${item.phrase}" ${modType} "${item.target}" (facteur: ${item.modification})`;
      }
      // Vérifier s'il s'agit d'une négation ou d'un type spécifique
      else if (item.type) {
        li.textContent = `"${item.phrase}" (type: ${item.type})`;
      }
      // Cas par défaut
      else {
        li.textContent = `"${item.phrase}" (modificateur)`;
      }

      list.appendChild(li);
    });
    modifiersList.appendChild(list);
  } else {
    modifiersList.textContent = "Aucun modificateur détecté.";
  }

  // Affichage des résultats
  resultsContainer.classList.add("active");
}

// Fonction pour afficher/masquer les détails
function toggleDetails(e) {
  const content = document.getElementById(
    e.currentTarget.id.replace("toggle-", "") + "-content"
  );
  content.classList.toggle("active");

  const plusMinus = e.currentTarget.querySelector("span:last-child");
  if (plusMinus) {
    plusMinus.textContent = content.classList.contains("active") ? "-" : "+";
  }
}

// Événement d'analyse
analyzeBtn.addEventListener("click", analyzeText);

// Analyse avec Enter
textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    analyzeText();
  }
});
