const express = require('express');
const cors = require('cors');
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const templates = {
  philo: {
    nom: "Philosophie Bac",
    style: "Nuancé, encourageant mais rigoureux",
    sections: [
      "COMPRÉHENSION ET PROBLÉMATISATION",
      "CLARTÉ ET LOGIQUE DE L'ARGUMENTATION",
      "QUALITÉ DES RÉFÉRENCES PHILOSOPHIQUES",
      "ORIGINALITÉ ET NUANCE DE LA PENSÉE",
      "MAÎTRISE DE LA LANGUE PHILOSOPHIQUE",
      "PLAN DE TRAVAIL PERSONNALISÉ"
    ],
    penseurs: ["Platon", "Aristote", "Descartes", "Hume", "Kant", "Hegel", "Nietzsche", "Sartre"],
    prompt_base: "Tu es un correcteur expert en philosophie du bac. Évalue cette copie avec rigueur mais bienveillance."
  },
  francais: {
    nom: "Français Bac",
    style: "Structuré, pédagogue, basé sur la méthodologie du bac",
    sections: [
      "COMPRÉHENSION DU SUJET",
      "STRUCTURE ET ORGANISATION",
      "QUALITÉ DE L'ANALYSE TEXTUELLE",
      "MAÎTRISE DE LA LANGUE",
      "ORIGINALITÉ ET PROFONDEUR",
      "PLAN DE TRAVAIL PERSONNALISÉ"
    ],
    penseurs: ["Molière", "Corneille", "Racine", "Hugo", "Balzac", "Flaubert", "Proust"],
    prompt_base: "Tu es un correcteur expert en français du bac. Évalue cette copie avec rigueur méthodique."
  },
  maths: {
    nom: "Mathématiques Bac",
    style: "Logique, pédagogue, axé sur la rigueur",
    sections: [
      "COMPRÉHENSION DE L'ÉNONCÉ",
      "RIGUEUR DU RAISONNEMENT",
      "QUALITÉ DES CALCULS",
      "JUSTIFICATION DES ÉTAPES",
      "PRÉSENTATION ET CLARTÉ",
      "PLAN DE TRAVAIL PERSONNALISÉ"
    ],
    penseurs: ["Euler", "Newton", "Leibniz", "Gauss", "Riemann"],
    prompt_base: "Tu es un correcteur expert en mathématiques du bac. Évalue cette copie avec rigueur logique."
  },
  histoire: {
    nom: "Histoire Bac",
    style: "Historique, analytique, basé sur la méthodologie du bac",
    sections: [
      "COMPRÉHENSION DE LA QUESTION",
      "CONNAISSANCE HISTORIQUE",
      "ANALYSE ET ARGUMENTATION",
      "UTILISATION DES DOCUMENTS",
      "MAÎTRISE DE LA LANGUE",
      "PLAN DE TRAVAIL PERSONNALISÉ"
    ],
    penseurs: ["Herodote", "Thucydide", "Tacite", "Bede", "Michelet"],
    prompt_base: "Tu es un correcteur expert en histoire du bac. Évalue cette copie avec rigueur analytique."
  }
};

function buildPrompt(matiere, copieData, profNotes, sujet) {
  const template = templates[matiere];

  return `
=== INSTRUCTIONS SYSTÈME ===
${template.prompt_base}

Tu dois évaluer une copie de ${template.nom} avec RIGUEUR et BIENVEILLANCE.

=== DIAGNOSTIC DU PROF ===
${profNotes.diagnostic}

Points forts:
${profNotes.pointsForts.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Points faibles:
${profNotes.pointsFaibles.map((p, i) => `${i + 1}. ${p}`).join('\n')}

=== COPIE DE L'ÉLÈVE ===
Sujet: ${sujet}
Note du prof: ${profNotes.note}/20

${copieData.contenu}

=== VOICI COMMENT TU DOIS STRUCTURER TA RÉPONSE ===

Crée un dossier avec exactement 6 sections:

## 1. ${template.sections[0]}
Analyze deeply what the student understood and what they missed. Point out strengths and gaps.

## 2. ${template.sections[1]}
Analyze the structure, flow of arguments, and logical connections. Identify weak links.

## 3. ${template.sections[2]}
Analyze references, examples, and their relevance. Suggest missing ones if appropriate.

## 4. ${template.sections[3]}
Assess originality and depth. Suggest perspectives to explore.

## 5. ${template.sections[4]}
Analyze language, vocabulary, and terminology used. Correct contresens.

## 6. ${template.sections[5]}
Provide 5 specific improvement points with:
- Why it matters
- How to improve (concrete actions)
- One exercise per point

At the end, add: "Estimated grade after these corrections: X/20"

Be encouraging but rigorous. Use French throughout.
`;
}

app.post('/api/generate-correction', async (req, res) => {
  try {
    const { matiere, copieData, profNotes, sujet } = req.body;

    const prompt = buildPrompt(matiere, copieData, profNotes, sujet);

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const dossier = message.content[0].text;

    res.json({
      success: true,
      dossier: dossier,
      metadata: {
        matiere,
        sujet,
        dateGeneration: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération',
      details: error.message
    });
  }
});

app.post('/api/schedule-visio', async (req, res) => {
  const { eleve, matiere, datetime, notes } = req.body;

  const roomName = `matineesbac-${eleve}-${matiere}-${Date.now()}`.replace(/[^a-z0-9-]/gi, '');
  const jitsiUrl = `https://meet.jit.si/${roomName}`;

  res.json({
    success: true,
    jitsiUrl: jitsiUrl,
    message: `✅ Visio programmée! Partage ce lien: ${jitsiUrl}`
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Les Matinées du Bac API'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend Les Matinées du Bac tourne sur port ${PORT}`);
  console.log(`API disponible sur http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
