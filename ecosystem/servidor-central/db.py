"""
db.py — SQLite como fonte única de verdade, no lugar do events.jsonl por
arquivo. Com 3 frontends podendo escrever ao mesmo tempo, um arquivo só
sem transação viraria risco de corrida; SQLite com WAL resolve isso de
graça, sem precisar de Postgres nem de um container a mais.
"""
import sqlite3
import os
import threading
import time
import glob

DB_PATH = os.environ.get('JORNADA_DB_PATH', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'jornada.db'))

_lock = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS couples (
    code TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    couple_code TEXT NOT NULL REFERENCES couples(code) ON DELETE CASCADE,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(couple_code, username)
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    couple_code TEXT NOT NULL REFERENCES couples(code) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(couple_code, event_id)
);
CREATE INDEX IF NOT EXISTS idx_events_couple ON events(couple_code, id);

CREATE TABLE IF NOT EXISTS profiles (
    couple_code TEXT PRIMARY KEY REFERENCES couples(code) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Diário: perguntas do quiz
CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    couple_code TEXT NOT NULL REFERENCES couples(code) ON DELETE CASCADE,
    pergunta TEXT NOT NULL,
    opcoes TEXT NOT NULL,
    resposta_correta TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quiz_couple ON quiz_questions(couple_code, id);

-- Diário: respostas dos dois ao quiz do dia
CREATE TABLE IF NOT EXISTS quiz_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    couple_code TEXT NOT NULL REFERENCES couples(code) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    resposta TEXT NOT NULL,
    previsao TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(couple_code, question_id, username)
);

-- Diário: cartas de amor
CREATE TABLE IF NOT EXISTS letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    couple_code TEXT NOT NULL REFERENCES couples(code) ON DELETE CASCADE,
    from_user TEXT NOT NULL,
    titulo TEXT NOT NULL DEFAULT '',
    corpo TEXT NOT NULL,
    lida INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_letters_couple ON letters(couple_code, id);

-- Diário: humor diário
CREATE TABLE IF NOT EXISTS moods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    couple_code TEXT NOT NULL REFERENCES couples(code) ON DELETE CASCADE,
    username TEXT NOT NULL,
    humor TEXT NOT NULL,
    nota INTEGER,
    texto TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE(couple_code, username, created_at)
);
CREATE INDEX IF NOT EXISTS idx_moods_couple ON moods(couple_code, id);

-- Uber: configurações
CREATE TABLE IF NOT EXISTS uber_settings (
    couple_code TEXT PRIMARY KEY REFERENCES couples(code) ON DELETE CASCADE,
    data TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
);

-- Uber: sessões
CREATE TABLE IF NOT EXISTS uber_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    couple_code TEXT NOT NULL REFERENCES couples(code) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    UNIQUE(couple_code, session_id)
);
CREATE INDEX IF NOT EXISTS idx_uber_sessions_couple ON uber_sessions(couple_code, id);

-- Uber: exceções de escala
CREATE TABLE IF NOT EXISTS uber_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    couple_code TEXT NOT NULL REFERENCES couples(code) ON DELETE CASCADE,
    date TEXT NOT NULL,
    override_type TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE(couple_code, date)
);
"""


def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # WAL: leitores não bloqueiam escritores, essencial com múltiplos
    # containers (app-diario, app-jogos, app-saude) batendo no mesmo banco.
    conn.execute('PRAGMA journal_mode=WAL;')
    conn.execute('PRAGMA foreign_keys=ON;')
    return conn


def init_db():
    with _lock:
        conn = get_conn()
        conn.executescript(SCHEMA)
        conn.commit()
        conn.close()


BACKUP_DIR = os.path.join(os.path.dirname(DB_PATH), 'backups')
BACKUP_MAX = 24  # manter apenas os ultimos 24 backups (1 por hora)


def _fazer_backup():
    """Copia o banco atual para data/backups/jornada_YYYY-MM-DD_HH.db"""
    try:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        ts = time.strftime('%Y-%m-%d_%H')
        dest_path = os.path.join(BACKUP_DIR, f'jornada_{ts}.db')

        src = sqlite3.connect(DB_PATH, timeout=10)
        dst = sqlite3.connect(dest_path, timeout=10)
        with dst:
            src.backup(dst)
        dst.close()
        src.close()

        # Limpa backups antigos (mantem os mais recentes)
        backups = sorted(glob.glob(os.path.join(BACKUP_DIR, 'jornada_*.db')))
        while len(backups) > BACKUP_MAX:
            os.remove(backups.pop(0))

        print(f'[backup] {dest_path}')
    except Exception as e:
        print(f'[backup] ERRO: {e}')


def _backup_loop():
    """Loop infinito: backup a cada 1 hora."""
    while True:
        time.sleep(3600)  # 1 hora
        _fazer_backup()


def start_backup_thread():
    """Inicia a thread de backup em background."""
    t = threading.Thread(target=_backup_loop, daemon=True)
    t.start()
    # Backup imediato ao iniciar
    _fazer_backup()
