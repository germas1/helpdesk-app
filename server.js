const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connexion BDD
const db = new Database('./database.db');
console.log("Connecté à la base de données SQLite.");

// Initialisation des tables
db.exec(`CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT,
    date TEXT,
    auuid TEXT,
    requester TEXT,
    hostname TEXT,
    category TEXT,
    item TEXT,
    priority TEXT,
    intervention TEXT,
    assignee TEXT,
    time_spent INTEGER,
    status TEXT,
    description TEXT,
    action TEXT
)`);

db.exec(`CREATE TABLE IF NOT EXISTS incident_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT UNIQUE,
    category TEXT,
    default_action TEXT,
    default_time INTEGER
)`);

const row = db.prepare("SELECT COUNT(*) as count FROM incident_types").get();
if (row.count === 0) {
    const stmt = db.prepare("INSERT INTO incident_types (label, category, default_action, default_time) VALUES (?, ?, ?, ?)");
    stmt.run("Compte Verrouillé", "Accounts and Access /User Accounts", "Unlock account", 8);
    stmt.run("Mot de passe expiré", "Accounts and Access /User Accounts", "Reset password", 5);
    stmt.run("Problème Outlook", "Software /Email", "Reconnected mail account & archived mailbox", 15);
    stmt.run("Configuration Oracle/Java", "Software /Application", "Installed Java V.8 134 and config Oracle", 18);
    stmt.run("Problème Imprimante", "Printer configuration", "Remove old printer & add new printer", 10);
}

// --- ROUTES API ---

// 1. Récupérer les tickets
app.get('/api/tickets/today', (req, res) => {
    try {
        const rows = db.prepare("SELECT * FROM tickets ORDER BY id DESC").all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Enregistrer un ticket
app.post('/api/tickets', (req, res) => {
    const data = req.body;
    const today = new Date().toISOString().split('T')[0];

    try {
        const row = db.prepare("SELECT COUNT(*) as count FROM tickets").get();
        const nextId = "INC-" + String(141 + row.count).padStart(6, '0');
        const query = `INSERT INTO tickets (ticket_id, date, auuid, requester, hostname, category, item, priority, intervention, assignee, time_spent, status, description, action)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [nextId, today, data.auuid, data.requester, data.hostname, data.category, data.item, data.priority, data.intervention, data.assignee, data.time_spent, data.status, data.description, data.action];

        db.prepare(query).run(...params);
        res.json({ message: "Ticket enregistré", ticket_id: nextId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Récupérer les types d'incidents
app.get('/api/incident-types', (req, res) => {
    try {
        const rows = db.prepare("SELECT * FROM incident_types").all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Ajouter un type d'incident
app.post('/api/incident-types', (req, res) => {
    const { label, category, default_action, default_time } = req.body;
    try {
        const info = db.prepare("INSERT INTO incident_types (label, category, default_action, default_time) VALUES (?, ?, ?, ?)")
                       .run(label, category, default_action, default_time);
        res.json({ message: "Ajouté avec succès", id: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Résumé pour le Team Leader
app.get('/api/team-summary/today', (req, res) => {
    try {
        const rows = db.prepare(`SELECT assignee, COUNT(*) as total_tickets, SUM(time_spent) as total_time FROM tickets GROUP BY assignee`).all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Export direct en fichier Excel (.xlsx) pour le Team Leader
app.get('/api/export/excel', (req, res) => {
    try {
        const rows = db.prepare("SELECT * FROM tickets ORDER BY id DESC").all();
        
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Incidents");
        
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="Rapport_Helpdesk.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur prêt sur le port ${PORT}`);
});