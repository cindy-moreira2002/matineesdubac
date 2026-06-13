import React, { useState, useEffect } from 'react';
import './App.css';

const API = process.env.REACT_APP_API_URL;

function App() {
  // Si l'URL contient ?eleve  -> on affiche l'espace ÉLÈVE (lien d'invitation)
  const isStudent = new URLSearchParams(window.location.search).has('eleve');
  return isStudent ? <StudentRoom /> : <TeacherApp />;
}

/* ============================== CÔTÉ PROF ============================== */

function TeacherApp() {
  const [page, setPage] = useState('bac');

  return (
    <div className="App">
      <header className="header">
        <div className="header-container">
          <h1>🌅 Les Matinées du Bac</h1>
          <nav>
            <button onClick={() => setPage('bac')} className={page === 'bac' ? 'active' : ''}>Bac Blanc (live)</button>
            <button onClick={() => setPage('correction')} className={page === 'correction' ? 'active' : ''}>Nouvelle correction</button>
            <button onClick={() => setPage('dashboard')} className={page === 'dashboard' ? 'active' : ''}>Dashboard</button>
          </nav>
        </div>
      </header>

      <main className="main">
        {page === 'bac' && <BacBlancPage />}
        {page === 'correction' && <CorrectionPage />}
        {page === 'dashboard' && <Dashboard />}
      </main>
    </div>
  );
}

function BacBlancPage() {
  const [students, setStudents] = useState([]);
  const [active, setActive] = useState(null); // élève dont on a ouvert le salon
  const [copied, setCopied] = useState(false);

  const inviteLink = window.location.origin + '/?eleve=1';

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/bac/students`);
        const d = await r.json();
        if (!stop) setStudents(d.students || []);
      } catch (e) { /* silencieux */ }
    };
    load();
    const t = setInterval(load, 4000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const onlineCount = students.filter(s => s.online).length;

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page">
      <h2>🎓 Bac Blanc — Salle de surveillance</h2>

      <div className="invite-box">
        <div>
          <strong>Lien à envoyer à tes élèves :</strong>
          <p className="invite-link">{inviteLink}</p>
        </div>
        <button onClick={copyLink} className="btn-secondary invite-btn">
          {copied ? '✅ Copié !' : '📋 Copier le lien'}
        </button>
      </div>

      <p className="presence-line">
        <span className="dot dot-online" /> {onlineCount} élève{onlineCount > 1 ? 's' : ''} en ligne
        &nbsp;·&nbsp; {students.length} inscrit{students.length > 1 ? 's' : ''}
      </p>

      {active && (
        <div className="room-panel">
          <div className="room-header">
            <h3>👀 Salon de {active.name}</h3>
            <button onClick={() => setActive(null)} className="btn-secondary room-leave">⬅️ Quitter le salon</button>
          </div>
          <JitsiRoom room={active.room} displayName="Professeur" height={560} />
        </div>
      )}

      {students.length === 0 && (
        <div className="empty-state">
          <p>Aucun élève pour l'instant. Envoie le lien ci-dessus à tes élèves : ils apparaîtront ici dès qu'ils se connectent. 🟢</p>
        </div>
      )}

      <div className="student-grid">
        {students.map(s => (
          <div key={s.id} className={'student-card ' + (s.online ? 'is-online' : 'is-offline')}>
            <div className="student-info">
              <span className={'dot ' + (s.online ? 'dot-online' : 'dot-offline')} />
              <div>
                <div className="student-name">{s.name}</div>
                {s.contact && <div className="student-contact">{s.contact}</div>}
              </div>
            </div>
            <button
              onClick={() => setActive(s)}
              className="btn-primary student-enter"
              disabled={!s.online}
            >
              {s.online ? '➡️ Entrer dans le salon' : 'Hors ligne'}
            </button>
          </div>
        ))}
      </div>
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
      const response = await fetch(`${API}/api/generate-correction`, {
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

/* ============================== CÔTÉ ÉLÈVE ============================== */

function StudentRoom() {
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [info, setInfo] = useState(null); // { studentId, room, name, contact }

  // Restaure la session si l'élève recharge la page
  useEffect(() => {
    const saved = localStorage.getItem('bacStudent');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        setInfo(d); setName(d.name || ''); setContact(d.contact || ''); setJoined(true);
      } catch (e) { /* ignore */ }
    }
  }, []);

  // Battement de cœur + départ propre
  useEffect(() => {
    if (!joined || !info) return;
    const beat = () => {
      fetch(`${API}/api/bac/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: info.studentId, name: info.name, contact: info.contact, room: info.room })
      }).catch(() => {});
    };
    beat();
    const t = setInterval(beat, 8000);
    const leave = () => {
      fetch(`${API}/api/bac/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: info.studentId }),
        keepalive: true
      }).catch(() => {});
    };
    window.addEventListener('pagehide', leave);
    return () => { clearInterval(t); window.removeEventListener('pagehide', leave); };
  }, [joined, info]);

  const handleJoin = async () => {
    if (!name.trim()) return alert('Indique ton nom 🙂');
    try {
      const r = await fetch(`${API}/api/bac/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact })
      });
      const d = await r.json();
      const data = { studentId: d.studentId, room: d.room, name: d.name, contact };
      localStorage.setItem('bacStudent', JSON.stringify(data));
      setInfo(data); setJoined(true);
    } catch (e) {
      alert('Erreur: ' + e.message);
    }
  };

  const handleLeave = () => {
    if (info) {
      fetch(`${API}/api/bac/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: info.studentId })
      }).catch(() => {});
    }
    localStorage.removeItem('bacStudent');
    setJoined(false); setInfo(null);
  };

  if (joined && info) {
    return (
      <div className="App">
        <header className="header">
          <div className="header-container">
            <h1>🌅 Les Matinées du Bac</h1>
            <button onClick={handleLeave} className="btn-secondary" style={{ width: 'auto' }}>Quitter</button>
          </div>
        </header>
        <main className="main">
          <div className="page">
            <h2>✅ Tu es connecté(e), {info.name} !</h2>
            <p className="student-hint">
              Reste sur cette page pendant le bac blanc. Ton professeur voit que tu es en ligne
              et viendra te rendre visite dans ton salon. 🟢
            </p>
            <JitsiRoom room={info.room} displayName={info.name} height={560} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="header">
        <div className="header-container">
          <h1>🌅 Les Matinées du Bac</h1>
        </div>
      </header>
      <main className="main">
        <div className="page" style={{ maxWidth: 520, margin: '0 auto' }}>
          <h2>🎓 Rejoindre le bac blanc</h2>
          <p className="student-hint">Entre tes infos pour rejoindre ta salle. Ton professeur te verra connecté(e).</p>

          <div className="form-group">
            <label>Ton prénom et nom :</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Léa Martin" />
          </div>

          <div className="form-group">
            <label>Ton email ou ton téléphone :</label>
            <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="lea.martin@email.com ou 06..." />
          </div>

          <button onClick={handleJoin} className="btn-primary">🚀 Rejoindre ma salle</button>
        </div>
      </main>
    </div>
  );
}

/* ============================== SALON VIDÉO (Jitsi) ============================== */

function JitsiRoom({ room, displayName, height = 560 }) {
  const src = `https://meet.jit.si/${room}` +
    `#config.prejoinPageEnabled=false` +
    `&config.disableDeepLinking=true` +
    `&userInfo.displayName=${encodeURIComponent('"' + (displayName || 'Invité') + '"')}`;
  return (
    <iframe
      title={`Salon ${room}`}
      src={src}
      allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
      style={{ width: '100%', height, border: 0, borderRadius: 12, marginTop: 16 }}
    />
  );
}

export default App;
