const express = require('express');
const cors = require('cors');
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');

// Transport Gmail (envoie à n'importe quelle adresse via mot de passe d'application)
const gmailTransport = (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    })
  : null;

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

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

// ===== BAC BLANC - Salons élèves en temps réel =====
// Présence en mémoire : qui est connecté, dans quel salon.
const bacStudents = new Map(); // studentId -> { id, name, contact, room, lastSeen }
const ONLINE_WINDOW_MS = 20000; // un élève est "en ligne" s'il a donné signe de vie < 20s

// L'élève rejoint le bac blanc : on lui crée un salon personnel
app.post('/api/bac/join', (req, res) => {
  const { name, contact } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nom requis' });
  const id = 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const room = 'matineesbac-' + id;
  bacStudents.set(id, { id, name: name.trim(), contact: (contact || '').trim(), room, lastSeen: Date.now() });
  res.json({ success: true, studentId: id, room, name: name.trim() });
});

// Battement de cœur : l'élève signale qu'il est toujours là (et se re-crée si le serveur a redémarré)
app.post('/api/bac/heartbeat', (req, res) => {
  const { studentId, name, contact, room } = req.body || {};
  if (!studentId) return res.status(400).json({ error: 'studentId requis' });
  const existing = bacStudents.get(studentId);
  if (existing) {
    existing.lastSeen = Date.now();
  } else if (name) {
    bacStudents.set(studentId, {
      id: studentId,
      name,
      contact: contact || '',
      room: room || ('matineesbac-' + studentId),
      lastSeen: Date.now()
    });
  }
  res.json({ success: true });
});

// L'élève quitte
app.post('/api/bac/leave', (req, res) => {
  const { studentId } = req.body || {};
  if (studentId) bacStudents.delete(studentId);
  res.json({ success: true });
});

// Le prof récupère la liste de tous les élèves avec leur statut en ligne
app.get('/api/bac/students', (req, res) => {
  const now = Date.now();
  const students = [...bacStudents.values()]
    .map(s => ({
      id: s.id,
      name: s.name,
      contact: s.contact,
      room: s.room,
      online: (now - s.lastSeen) < ONLINE_WINDOW_MS
    }))
    .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || a.name.localeCompare(b.name));
  res.json({ success: true, students });
});

// ===== BILAN EXPRESS d'une copie (analyse IA + email) =====
const MATIERE_LABEL = {
  francais: 'Français', philo: 'Philosophie', maths: 'Mathématiques',
  histoire: 'Histoire-Géographie', hggsp: 'HGGSP', ses: 'SES'
};

const GRILLES = {
  francais: "Note /20 (compréhension du sujet, argumentation/plan, références/citations, organisation/introduction, expression, richesse culturelle). Attendus : analyser chaque procédé en 3 étapes (procédé nommé + lien avec l'argument + lien avec la thèse) ; définir les mots-clés dès l'introduction ; en dissertation, consacrer une sous-partie entière à une autre œuvre ; problématique claire ; plan progressif ; conclusion + ouverture. Sanctionner : paraphrase, citations non analysées, plan déséquilibré, mots-clés non définis.",
  philo: "Notation globale /20 (médiane ~11,5). Valoriser : problématisation (≠ reformulation), argumentation progressive et articulée, références philosophiques reliées au sujet, distinctions conceptuelles, exemples analysés. Planchers : pas moins de 12 si le raisonnement est construit et justifié ; pas moins de 16 si le problème est expliqué + raisonnement construit + références pertinentes. Sanctionner : récitation de cours non pertinente, catalogue d'auteurs, hors-sujet, absence de problème.",
  maths: "Notation par barème (question par question). Le raisonnement prime sur le résultat : justifier chaque étape (théorème nommé ; récurrence = initialisation + hérédité + conclusion), rédaction rigoureuse (quantificateurs, connecteurs « donc/or/ainsi », phrase de conclusion), exactitude des calculs, arrondis demandés. Valoriser l'initiative et la vérification de cohérence. Sanctionner : résultat sans justification, récurrence incomplète, confusion fonction/dérivée, erreurs de calcul en chaîne, absence de conclusion.",
  histoire: "Note globale /20 (Très insuffisant <6, Insuffisant 6-9, Suffisant 10-15, Très bon ≥16). Composition (~12 pts) + étude de document(s) (~8 pts). Attendus : repères précis (dates, lieux, acteurs), définir les termes, plan structuré avec fil conducteur, intro + conclusion. Étude de doc : sens global + contexte + appui sur le document + regard critique (source). Sanctionner : récit sans structure, paraphrase du document, repères absents ou faux.",
  hggsp: "Deux exercices notés /10 (dissertation + étude critique de documents). Évaluation par compétence (insuffisant 0-3, fragile 3,5-5,5, satisfaisant 6-8, très satisfaisant 8,5-10). Dissertation : connaissances + jalons précis, plan saisissant tout le sujet, problématique réelle, démarche réflexive, langue. Étude critique : comprendre, contextualiser (apports extérieurs au doc), confronter, approche critique (source + nature), notions. Sanctionner : paraphrase, aucune connaissance extérieure, absence de critique de la source.",
  ses: "Dissertation /20 OU épreuve composée (EC1 connaissances /6, EC2 étude de document /4, EC3 raisonnement /10). Attendus : expliciter les MÉCANISMES (pas seulement nommer les notions), lire et interpréter correctement les données chiffrées (distinguer % et points de %), exploiter les documents en lien avec l'argument, problématique + plan cohérent. Sanctionner : notions citées sans mécanisme, paraphrase des documents, mauvaise lecture des chiffres, consigne non respectée."
};

async function sendBilanEmail(to, prenom, matiereLabel, bilan) {
  if (!to) return { sent: false, reason: 'no_email' };
  const forts = (bilan.pointsForts || []).map(p => `<li style="margin-bottom:6px">${p}</li>`).join('');
  const axes = (bilan.axes || []).map(a => `<li style="margin-bottom:8px"><b>${a.axe}</b> &nbsp;<span style="color:#059669;font-weight:700">${a.gain}</span></li>`).join('');
  const html = `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:600px;margin:auto;color:#1a1a1a">
    <div style="background:linear-gradient(135deg,#ff6b57,#ffb26b);padding:28px;border-radius:14px 14px 0 0;color:#fff">
      <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:.9">Les Matinées du Bac · Bilan express</div>
      <h1 style="margin:6px 0 0;font-size:24px">Ton bilan en ${matiereLabel}</h1>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 14px 14px;padding:28px">
      <p>Salut ${prenom || ''} 👋 Voici ton bilan express, basé sur les critères officiels de correction en ${matiereLabel}.</p>
      <p style="font-size:18px"><b>Note estimée : ${bilan.noteEstimee}/20</b> &nbsp;→&nbsp; <b style="color:#059669">objectif ${bilan.noteCible}/20</b></p>
      <h3 style="color:#ff6b57">✅ Ce que tu maîtrises</h3>
      <ul>${forts}</ul>
      <h3 style="color:#ff6b57">🎯 Ce que tu dois travailler (et les points à gagner)</h3>
      <ul>${axes}</ul>
      <p style="background:#FFF7ED;border-radius:10px;padding:14px"><b>🚀 ${bilan.projection || ''}</b></p>
      <p>${bilan.message || ''}</p>
      <p style="margin-top:20px"><a href="https://lesmatineesdubac.com" style="background:#ff6b57;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">Réserver mon 1er bac blanc →</a></p>
      <p style="font-size:12px;color:#888;margin-top:20px">Ce bilan express est indicatif. En passant un vrai bac blanc, tu reçois un dossier complet et personnalisé sur ta copie.</p>
    </div>
  </div>`;
  const subject = `📄 Ton bilan ${matiereLabel} — Les Matinées du Bac`;

  // 1. Gmail en priorité (envoie à n'importe quelle adresse)
  if (gmailTransport) {
    try {
      await gmailTransport.sendMail({
        from: `"Les Matinées du Bac" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html
      });
      return { sent: true, via: 'gmail' };
    } catch (e) {
      return { sent: false, error: e.message, via: 'gmail' };
    }
  }

  // 2. Repli sur Resend si pas de Gmail configuré
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: 'no_email_method' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Les Matinées du Bac <onboarding@resend.dev>',
        to: [to],
        subject,
        html
      })
    });
    const data = await r.json().catch(() => ({}));
    return { sent: r.ok, data, via: 'resend' };
  } catch (e) {
    return { sent: false, error: e.message, via: 'resend' };
  }
}

app.post('/api/bilan', async (req, res) => {
  try {
    const { matiere, copieTexte, image, imageType, email, prenom } = req.body || {};
    if (!matiere || !GRILLES[matiere]) return res.status(400).json({ error: 'Matière invalide' });
    const hasText = copieTexte && copieTexte.trim().length > 20;
    if (!hasText && !image) return res.status(400).json({ error: 'Copie manquante (texte ou image).' });

    const label = MATIERE_LABEL[matiere];
    const consigne = `Tu es correcteur expert du baccalauréat en ${label}. On te donne la copie d'un élève. À partir des CRITÈRES OFFICIELS ci-dessous, rédige un BILAN EXPRESS clair et bienveillant (pas un dossier complet) pour que l'élève voie précisément ce qu'il doit travailler et combien de points il peut gagner.

CRITÈRES OFFICIELS ${label} :
${GRILLES[matiere]}

Réponds UNIQUEMENT par un objet JSON valide (rien d'autre autour), de la forme :
{
 "noteEstimee": <nombre sur 20>,
 "noteCible": <nombre sur 20 atteignable avec du travail>,
 "pointsForts": ["point fort concret", "..."],
 "axes": [{"axe": "ce qu'il faut travailler, concret et actionnable", "gain": "+X pt(s)"}, ...],
 "projection": "une phrase de projection motivante",
 "message": "une phrase d'encouragement personnalisée"
}
2 à 4 points forts, 3 à 5 axes. Sois précis, concret, et fonde-toi sur ce qui est réellement dans la copie.`;

    const content = [];
    if (image) {
      content.push({ type: 'image', source: { type: 'base64', media_type: imageType || 'image/jpeg', data: image } });
      content.push({ type: 'text', text: consigne + "\n\nLa copie de l'élève est l'image ci-jointe." });
    } else {
      content.push({ type: 'text', text: consigne + "\n\n=== COPIE DE L'ÉLÈVE ===\n" + copieTexte });
    }

    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      messages: [{ role: 'user', content }]
    });

    let raw = (msg.content[0] && msg.content[0].text || '').trim();
    const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
    let bilan;
    try { bilan = JSON.parse(raw.slice(start, end + 1)); }
    catch (e) { return res.status(502).json({ error: 'Réponse IA illisible', raw }); }

    let emailResult = { sent: false };
    if (email) emailResult = await sendBilanEmail(email, prenom, label, bilan);

    res.json({ success: true, matiere: label, bilan, email: emailResult });
  } catch (error) {
    console.error('Erreur bilan:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du bilan', details: error.message });
  }
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
