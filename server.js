const express = require('express');
const path = require('path');
const { analyzer, contextualAnalyzer } = require('./src/analyzer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour analyser les requêtes JSON
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Route API pour l'analyse de sentiment standard
app.post('/api/analyze', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Aucun texte fourni' });
    }
    
    const result = analyzer.analyze(text);
    res.json({ result });
  } catch (error) {
    console.error('Erreur d\'analyse:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'analyse du texte',
      details: error.message
    });
  }
});

// Route API pour l'analyse de sentiment contextuelle
app.post('/api/analyze-contextual', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Aucun texte fourni' });
    }
    
    const result = contextualAnalyzer.analyze(text);
    res.json({ result });
  } catch (error) {
    console.error('Erreur d\'analyse contextuelle:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'analyse contextuelle du texte',
      details: error.message
    });
  }
});

// Route pour tester l'API
app.get('/test', (req, res) => {
  const testTexts = [
    "Ce film était vraiment excellent, j'ai adoré !",
    "Je suis très déçu de ce produit, il ne fonctionne pas correctement.",
    "Bonjour aujourd'hui je me suis levé un petit peu tard j'avoue que j'ai des cernes sous les yeux et côté heureux c'est bof bof",
    "Au début j'étais inquiet à propos de ce changement, mais finalement le résultat est vraiment satisfaisant."
  ];
  
  const results = {
    standard: testTexts.map(text => ({ text, analysis: analyzer.analyze(text) })),
    contextual: testTexts.map(text => ({ text, analysis: contextualAnalyzer.analyze(text) }))
  };
  
  res.json(results);
});

// Servir l'application frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware pour gérer les erreurs 404
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Middleware pour gérer les erreurs globales
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    details: err.message 
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  console.log(`- Analyseur standard disponible à http://localhost:${PORT}/api/analyze`);
  console.log(`- Analyseur contextuel disponible à http://localhost:${PORT}/api/analyze-contextual`);
  console.log(`- Test de l'API disponible à http://localhost:${PORT}/test`);
});

