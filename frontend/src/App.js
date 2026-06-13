import React, { useState } from 'react';
import './App.css';

function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <div className="App">
      <header className="header">
        <div className="header-container">
          <h1>🌅 Les Matinées du Bac</h1>
          <nav>
            <button onClick={() => setPage('dashboard')} className={page === 'dashboard' ? 'active' : ''}>Dashboard</button>
            <button onClick={() => setPage('correction')} className={page === 'correction' ? 'active' : ''}>Nouvelle correction</button>
            <button onClick={() => setPage('visio')} className={page === 'visio' ? 'active' : ''}>Programmer visio</button>
          </nav>
        </div>
      </header>

      <main className="main">
        {page === 'dashboard' && <Dashboard />}
        {page === 'correction' && <CorrectionPage />}
        {page === 'visio' && <VisioPage />}
      </main>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="page">
      <h2>📊 Mon Dashboard</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Élèves</h3>
          <p className="big-number">12</p>
        </div>
        <div className="stat-card">
          <h3>Corrections ce mois</h3>
          <p className="big-number">18</p>
        </div>
        <div className="stat-card">
          <h3>Revenus</h3>
          <p className="big-number">450€</p>
        </div>
      </div>
    </div>
  );
}

function CorrectionPage() {
  const [matiere, setMatiere] = useState('philo');
  const [copie, setCopie] = useState('');
  const [diagnostic, setDiagnostic] = useState('');
  const [pointsForts, setPointsForts] = useState('');
  const [pointsFaibles, setPointsFaibles] = useState('');
  const [note, setNote] = useState(12);
  const [sujet, setSujet] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/generate-correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matiere,
          copieData: { contenu: copie },
          profNotes: {
            diagnostic,
            pointsForts: pointsForts.split('\n').filter(p => p),
            pointsFaibles: pointsFaibles.split('\n').filter(p => p),
            note: parseInt(note)
          },
          sujet
        })
      });
      const data = await response.json();
      setResult(data.dossier);
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="page">
      <h2>📚 Nouvelle Correction</h2>

      <div className="form-group">
        <label>Matière:</label>
        <select value={matiere} onChange={(e) => setMatiere(e.target.value)}>
          <option value="philo">Philosophie</option>
          <option value="francais">Français</option>
          <option value="maths">Mathématiques</option>
          <option value="histoire">Histoire</option>
        </select>
      </div>

      <div className="form-group">
        <label>Copie de l'élève:</label>
        <textarea
          value={copie}
          onChange={(e) => setCopie(e.target.value)}
          placeholder="Colle la copie ici..."
          rows={8}
        />
      </div>

      <div className="form-group">
        <label>Diagnostic rapide (2-3 lignes):</label>
        <textarea
          value={diagnostic}
          onChange={(e) => setDiagnostic(e.target.value)}
          placeholder="L'élève a bien compris mais manque de transitions..."
          rows={3}
        />
      </div>

      <div className="form-group">
        <label>Points forts (un par ligne):</label>
        <textarea
          value={pointsForts}
          onChange={(e) => setPointsForts(e.target.value)}
          placeholder="Bonne citation de Descartes&#10;Références pertinentes&#10;Pensée personnelle"
          rows={3}
        />
      </div>

      <div className="form-group">
        <label>Points faibles (un par ligne):</label>
        <textarea
          value={pointsFaibles}
          onChange={(e) => setPointsFaibles(e.target.value)}
          placeholder="Transitions faibles&#10;Manque de nuance&#10;Conclusion rapide"
          rows={3}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Note /20:</label>
          <input type="number" min="0" max="20" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Sujet exact:</label>
          <input type="text" value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Peut-on connaître la vérité?" />
        </div>
      </div>

      <button onClick={handleGenerate} disabled={loading} className="btn-primary">
        {loading ? '⏳ Génération en cours...' : '✨ Générer le dossier'}
      </button>

      {result && (
        <div className="result">
          <h3>📖 Dossier généré:</h3>
          <div className="dossier-text">
            {result.substring(0, 1500)}...
          </div>
          <button onClick={() => navigator.clipboard.writeText(result)} className="btn-secondary">
            📋 Copier le dossier complet
          </button>
        </div>
      )}
    </div>
  );
}

function VisioPage() {
  const [eleve, setEleve] = useState('');
  const [matiere, setMatiere] = useState('philo');
  const [datetime, setDatetime] = useState('');
  const [notes, setNotes] = useState('');
  const [jitsiUrl, setJitsiUrl] = useState(null);

  const handleSchedule = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule-visio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eleve, matiere, datetime, notes })
      });
      const data = await response.json();
      setJitsiUrl(data.jitsiUrl);
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  return (
    <div className="page">
      <h2>📞 Programmer une visio</h2>

      <div className="form-group">
        <label>Élève:</label>
        <input type="text" value={eleve} onChange={(e) => setEleve(e.target.value)} placeholder="Nom de l'élève" />
      </div>

      <div className="form-group">
        <label>Matière:</label>
        <select value={matiere} onChange={(e) => setMatiere(e.target.value)}>
          <option value="philo">Philosophie</option>
          <option value="francais">Français</option>
          <option value="maths">Mathématiques</option>
          <option value="histoire">Histoire</option>
        </select>
      </div>

      <div className="form-group">
        <label>Date et heure:</label>
        <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
      </div>

      <div className="form-group">
        <label>Sujets à couvrir:</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Transitions, Hume, structure..." rows={3} />
      </div>

      <button onClick={handleSchedule} className="btn-primary">
        ✅ Programmer la visio
      </button>

      {jitsiUrl && (
        <div className="result">
          <h3>✅ Visio programmée!</h3>
          <p>Lien: <input type="text" value={jitsiUrl} readOnly /></p>
          <button onClick={() => window.open(jitsiUrl)} className="btn-secondary">
            ▶️ Ouvrir la visio
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
