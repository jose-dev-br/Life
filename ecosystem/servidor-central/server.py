#!/usr/bin/env python3
"""
servidor-central/server.py — versão com SQLite + JWT.

Foco desta etapa: cadastro/login de usuário dentro de um casal, e sync de
eventos protegido por token. Os endpoints de fotos/stickers da versão
anterior (arquivo em disco) continuam válidos e podem ser recolocados
depois -- eles não mudam com essa migração, só os EVENTOS e o CADASTRO
é que saem do arquivo/JSONL e vão pro banco.

Endpoints:
  POST /api/couple/create                    -> cria casal, devolve o código
  POST /api/auth/register {couple,user,senha} -> cria conta nesse casal, devolve token
  POST /api/auth/login    {couple,user,senha} -> devolve token
  GET  /api/auth/me       (Authorization: Bearer <token>)
  POST /api/sync?couple=CODE (Authorization obrigatório) -> envia eventos novos
  GET  /api/sync?couple=CODE (Authorization obrigatório) -> puxa eventos
"""
import http.server
import socketserver
import json
import re
import time
import random
import string
from urllib.parse import urlparse, parse_qs

import db
import auth

PORT = 8000
MAX_BODY_BYTES = 2 * 1024 * 1024
CODE_RE = re.compile(r'^[A-Z0-9]{6}$')
USERNAME_RE = re.compile(r'^[a-zA-Z0-9_.-]{2,32}$')

# Rate limit: max 10 tentativas de login por IP a cada 5 minutos
_login_attempts = {}
RATE_LIMIT_WINDOW = 300  # 5 minutos
RATE_LIMIT_MAX = 10


def _rate_limit_check(ip):
    now = time.time()
    attempts = _login_attempts.get(ip, [])
    attempts = [t for t in attempts if now - t < RATE_LIMIT_WINDOW]
    _login_attempts[ip] = attempts
    return len(attempts) < RATE_LIMIT_MAX


def _rate_limit_record(ip):
    _login_attempts.setdefault(ip, []).append(time.time())


def gerar_codigo():
    alfabeto = string.ascii_uppercase + string.digits
    return ''.join(random.choice(alfabeto) for _ in range(6))


class SyncHandler(http.server.BaseHTTPRequestHandler):
    def _json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        origin = self._allowed_origin()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Vary', 'Origin')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.end_headers()
        self.wfile.write(body)

    def _allowed_origin(self):
        origin = (self.headers.get('Origin', '') or '').strip()
        if not origin:
            return '*'

        try:
            parsed = urlparse(origin)
        except Exception:
            return '*'

        if parsed.scheme in {'http', 'https'}:
            return origin

        return '*'

    def _read_json(self):
        length = int(self.headers.get('Content-Length', 0))
        if length > MAX_BODY_BYTES:
            raise ValueError('corpo grande demais')
        raw = self.rfile.read(length) if length else b'{}'
        return json.loads(raw or b'{}')

    def _auth_claims(self):
        """Decodifica o Bearer token ou devolve None se inválido/ausente."""
        token = auth.extract_bearer_token(self.headers.get('Authorization', ''))
        if not token:
            return None
        try:
            return auth.jwt_decode(token)
        except auth.JWTError:
            return None

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', self._allowed_origin())
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', '0')
        self.end_headers()

    # ---------------- POST ----------------
    def do_POST(self):
        route = urlparse(self.path).path
        try:
            if route == '/api/couple/create':
                return self._criar_casal()
            if route == '/api/auth/register':
                return self._registrar()
            if route == '/api/auth/login':
                return self._login()
            if route == '/api/sync':
                return self._sync_post()
            if route == '/api/diary/quiz/create':
                return self._quiz_create()
            if route == '/api/diary/quiz/answer':
                return self._quiz_answer()
            if route == '/api/diary/letter':
                return self._letter_send()
            if route == '/api/diary/mood':
                return self._mood_log()
            if route == '/api/uber/settings':
                return self._uber_save_settings()
            if route == '/api/uber/sessions':
                return self._uber_save_session()
            if route == '/api/uber/overrides':
                return self._uber_save_override()
            self._json(404, {'ok': False, 'error': 'rota não encontrada'})
        except ValueError as e:
            self._json(400, {'ok': False, 'error': str(e)})

    def _criar_casal(self):
        code = gerar_codigo()
        conn = db.get_conn()
        # regenera se colidir (extremamente raro com 36^6 combinações)
        while conn.execute('SELECT 1 FROM couples WHERE code=?', (code,)).fetchone():
            code = gerar_codigo()
        conn.execute('INSERT INTO couples (code, created_at) VALUES (?, ?)', (code, _now_iso()))
        conn.commit()
        conn.close()
        self._json(200, {'ok': True, 'code': code})

    def _registrar(self):
        body = self._read_json()
        code = (body.get('couple') or '').strip().upper()
        username = (body.get('usuario') or '').strip()
        senha = body.get('senha') or ''

        if not CODE_RE.match(code):
            return self._json(400, {'ok': False, 'error': 'código de casal inválido'})
        if not USERNAME_RE.match(username):
            return self._json(400, {'ok': False, 'error': 'usuário inválido (2-32 caracteres, sem espaço)'})
        if len(senha) < 4:
            return self._json(400, {'ok': False, 'error': 'senha muito curta (mín. 4 caracteres)'})

        conn = db.get_conn()
        if not conn.execute('SELECT 1 FROM couples WHERE code=?', (code,)).fetchone():
            conn.close()
            return self._json(404, {'ok': False, 'error': 'esse código de casal não existe'})

        existentes = conn.execute('SELECT COUNT(*) c FROM users WHERE couple_code=?', (code,)).fetchone()['c']
        if existentes >= 2:
            conn.close()
            return self._json(409, {'ok': False, 'error': 'esse casal já tem 2 contas cadastradas'})

        if conn.execute('SELECT 1 FROM users WHERE couple_code=? AND username=?', (code, username)).fetchone():
            conn.close()
            return self._json(409, {'ok': False, 'error': 'esse usuário já existe nesse casal'})

        senha_hash = auth.hash_password(senha)
        conn.execute(
            'INSERT INTO users (couple_code, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
            (code, username, senha_hash, _now_iso()),
        )
        conn.commit()
        conn.close()

        token = auth.jwt_encode({'sub': username, 'couple': code})
        self._json(200, {'ok': True, 'token': token})

    def _login(self):
        body = self._read_json()
        code = (body.get('couple') or '').strip().upper()
        username = (body.get('usuario') or '').strip()
        senha = body.get('senha') or ''

        # Rate limit por IP
        ip = self.headers.get('X-Forwarded-For', self.client_address[0]).split(',')[0].strip()
        if not _rate_limit_check(ip):
            return self._json(429, {'ok': False, 'error': 'muitas tentativas, aguarde 5 minutos'})

        conn = db.get_conn()
        row = conn.execute(
            'SELECT password_hash FROM users WHERE couple_code=? AND username=?', (code, username)
        ).fetchone()
        conn.close()

        if not row or not auth.verify_password(senha, row['password_hash']):
            _rate_limit_record(ip)
            return self._json(401, {'ok': False, 'error': 'usuário, senha ou código incorretos'})

        token = auth.jwt_encode({'sub': username, 'couple': code})
        self._json(200, {'ok': True, 'token': token})

    def _sync_post(self):
        query = parse_qs(urlparse(self.path).query)
        code = (query.get('couple') or [''])[0].strip().upper()
        claims = self._auth_claims()
        if not claims or claims.get('couple') != code:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})

        body = self._read_json()
        eventos = body.get('events', [])
        conn = db.get_conn()
        novos = 0
        for ev in eventos:
            try:
                conn.execute(
                    'INSERT INTO events (couple_code, event_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)',
                    (code, ev['id'], ev['type'], json.dumps(ev.get('payload', {}), ensure_ascii=False), ev.get('createdAt') or _now_iso()),
                )
                novos += 1
            except Exception:
                pass  # já existe (UNIQUE) -- sync é idempotente, ignora duplicado
        conn.commit()
        conn.close()
        self._json(200, {'ok': True, 'recebidos': novos})

    # ---------------- GET ----------------
    def do_GET(self):
        route = urlparse(self.path).path
        if route == '/api/auth/me':
            return self._me()
        if route == '/api/sync':
            return self._sync_get()
        if route == '/api/couple/users':
            return self._couple_users()
        if route == '/api/diary/quiz/today':
            return self._quiz_today()
        if route == '/api/diary/quiz/history':
            return self._quiz_history()
        if route == '/api/diary/letters':
            return self._letters_list()
        if route == '/api/diary/mood':
            return self._mood_list()
        if route == '/api/diary/mood/today':
            return self._mood_today()
        if route == '/api/diary/stats':
            return self._diary_stats()
        if route == '/api/couple/lookup':
            return self._couple_lookup()
        if route == '/api/uber/settings':
            return self._uber_get_settings()
        if route == '/api/uber/sessions':
            return self._uber_get_sessions()
        if route == '/api/uber/overrides':
            return self._uber_get_overrides()
        self._json(404, {'ok': False, 'error': 'rota não encontrada'})

    def _couple_lookup(self):
        qs = parse_qs(urlparse(self.path).query)
        user = (qs.get('user') or [None])[0]
        if not user or len(user.strip()) < 2:
            return self._json(400, {'ok': False, 'error': 'informe o nome de usuário'})
        conn = db.get_conn(); c = conn.cursor()
        c.execute('SELECT DISTINCT couple_code FROM users WHERE LOWER(username)=LOWER(?)', (user.strip(),))
        rows = c.fetchall(); conn.close()
        if not rows:
            return self._json(404, {'ok': False, 'error': 'nenhum casal encontrado para esse usuário'})
        codes = [r[0] for r in rows]
        self._json(200, {'ok': True, 'codes': codes})

    def _me(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        self._json(200, {'ok': True, 'usuario': claims['sub'], 'couple': claims['couple']})

    def _couple_users(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        conn = db.get_conn()
        rows = conn.execute('SELECT username FROM users WHERE couple_code=? ORDER BY id ASC', (code,)).fetchall()
        conn.close()
        self._json(200, {'ok': True, 'users': [r['username'] for r in rows]})

    def _sync_get(self):
        query = parse_qs(urlparse(self.path).query)
        code = (query.get('couple') or [''])[0].strip().upper()
        claims = self._auth_claims()
        if not claims or claims.get('couple') != code:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})

        conn = db.get_conn()
        rows = conn.execute(
            'SELECT event_id, type, payload, created_at FROM events WHERE couple_code=? ORDER BY id ASC', (code,)
        ).fetchall()
        conn.close()

        eventos = [
            {'id': r['event_id'], 'type': r['type'], 'payload': json.loads(r['payload']), 'createdAt': r['created_at']}
            for r in rows
        ]
        self._json(200, {'ok': True, 'events': eventos})

    # ==================== DIÁRIO: QUIZ ====================

    def _quiz_create(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        body = self._read_json()
        pergunta = (body.get('pergunta') or '').strip()
        opcoes = body.get('opcoes', [])
        if not pergunta or len(opcoes) < 2:
            return self._json(400, {'ok': False, 'error': 'pergunta e pelo menos 2 opções'})

        conn = db.get_conn()
        conn.execute(
            'INSERT INTO quiz_questions (couple_code, pergunta, opcoes, created_at) VALUES (?, ?, ?, ?)',
            (code, pergunta, json.dumps(opcoes, ensure_ascii=False), _now_iso()),
        )
        conn.commit()
        qid = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        conn.close()
        self._json(200, {'ok': True, 'question_id': qid})

    def _quiz_today(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        today = time.strftime('%Y-%m-%d')
        conn = db.get_conn()
        row = conn.execute(
            'SELECT id, pergunta, opcoes, created_at FROM quiz_questions WHERE couple_code=? AND created_at LIKE ? ORDER BY id DESC LIMIT 1',
            (code, today + '%'),
        ).fetchone()
        if not row:
            conn.close()
            return self._json(200, {'ok': True, 'quiz': None})
        qid = row['id']
        answers_rows = conn.execute(
            'SELECT username, resposta, previsao FROM quiz_answers WHERE couple_code=? AND question_id=?',
            (code, qid),
        ).fetchall()
        conn.close()
        answers = {r['username']: {'resposta': r['resposta'], 'previsao': r['previsao']} for r in answers_rows}
        self._json(200, {
            'ok': True,
            'quiz': {
                'id': qid,
                'pergunta': row['pergunta'],
                'opcoes': json.loads(row['opcoes']),
                'created_at': row['created_at'],
                'answers': answers,
            }
        })

    def _quiz_answer(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        user = claims['sub']
        body = self._read_json()
        question_id = body.get('question_id')
        resposta = (body.get('resposta') or '').strip()
        previsao = (body.get('previsao') or '').strip() or None
        if not question_id or not resposta:
            return self._json(400, {'ok': False, 'error': 'question_id e resposta obrigatórios'})

        conn = db.get_conn()
        try:
            conn.execute(
                'INSERT INTO quiz_answers (couple_code, question_id, username, resposta, previsao, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                (code, question_id, user, resposta, previsao, _now_iso()),
            )
            conn.commit()
        except Exception:
            conn.close()
            return self._json(409, {'ok': False, 'error': 'já respondeu esse quiz'})
        conn.close()
        self._json(200, {'ok': True})

    def _quiz_history(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        conn = db.get_conn()
        rows = conn.execute(
            'SELECT q.id, q.pergunta, q.opcoes, q.created_at, '
            'a1.resposta as resp_user1, a1.previsao as prev_user1, a1.username as user1, '
            'a2.resposta as resp_user2, a2.previsao as prev_user2, a2.username as user2 '
            'FROM quiz_questions q '
            'LEFT JOIN quiz_answers a1 ON a1.question_id=q.id AND a1.username=(SELECT username FROM users WHERE couple_code=? ORDER BY id ASC LIMIT 1) '
            'LEFT JOIN quiz_answers a2 ON a2.question_id=q.id AND a2.username=(SELECT username FROM users WHERE couple_code=? ORDER BY id DESC LIMIT 1) '
            'WHERE q.couple_code=? ORDER BY q.id DESC LIMIT 50',
            (code, code, code),
        ).fetchall()
        conn.close()
        quizzes = []
        for r in rows:
            quizzes.append({
                'id': r['id'],
                'pergunta': r['pergunta'],
                'opcoes': json.loads(r['opcoes']),
                'created_at': r['created_at'],
                'user1': {'username': r['user1'], 'resposta': r['resp_user1'], 'previsao': r['prev_user1']},
                'user2': {'username': r['user2'], 'resposta': r['resp_user2'], 'previsao': r['prev_user2']},
                'bateu': r['resp_user1'] and r['resp_user2'] and r['resp_user1'] == r['resp_user2'],
            })
        self._json(200, {'ok': True, 'quizzes': quizzes})

    # ==================== DIÁRIO: CARTAS ====================

    def _letter_send(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        user = claims['sub']
        body = self._read_json()
        titulo = (body.get('titulo') or '').strip()
        corpo = (body.get('corpo') or '').strip()
        if not corpo:
            return self._json(400, {'ok': False, 'error': 'corpo da carta obrigatório'})

        conn = db.get_conn()
        conn.execute(
            'INSERT INTO letters (couple_code, from_user, titulo, corpo, created_at) VALUES (?, ?, ?, ?, ?)',
            (code, user, titulo, corpo, _now_iso()),
        )
        conn.commit()
        conn.close()
        self._json(200, {'ok': True})

    def _letters_list(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        conn = db.get_conn()
        rows = conn.execute(
            'SELECT id, from_user, titulo, corpo, lida, created_at FROM letters WHERE couple_code=? ORDER BY id DESC LIMIT 100',
            (code,),
        ).fetchall()
        conn.close()
        letters = [{'id': r['id'], 'from': r['from_user'], 'titulo': r['titulo'], 'corpo': r['corpo'], 'lida': bool(r['lida']), 'created_at': r['created_at']} for r in rows]
        self._json(200, {'ok': True, 'letters': letters})

    # ==================== DIÁRIO: HUMOR ====================

    def _mood_log(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        user = claims['sub']
        body = self._read_json()
        humor = (body.get('humor') or '').strip()
        nota = body.get('nota')
        texto = (body.get('texto') or '').strip()
        if not humor:
            return self._json(400, {'ok': False, 'error': 'humor obrigatório'})

        today = time.strftime('%Y-%m-%d')
        conn = db.get_conn()
        try:
            conn.execute(
                'INSERT INTO moods (couple_code, username, humor, nota, texto, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                (code, user, humor, nota, texto, today),
            )
            conn.commit()
        except Exception:
            conn.execute(
                'UPDATE moods SET humor=?, nota=?, texto=? WHERE couple_code=? AND username=? AND created_at=?',
                (humor, nota, texto, code, user, today),
            )
            conn.commit()
        conn.close()
        self._json(200, {'ok': True})

    def _mood_today(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        today = time.strftime('%Y-%m-%d')
        conn = db.get_conn()
        rows = conn.execute(
            'SELECT username, humor, nota, texto, created_at FROM moods WHERE couple_code=? AND created_at=?',
            (code, today),
        ).fetchall()
        conn.close()
        moods = [{'username': r['username'], 'humor': r['humor'], 'nota': r['nota'], 'texto': r['texto']} for r in rows]
        self._json(200, {'ok': True, 'moods': moods})

    def _mood_list(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        conn = db.get_conn()
        rows = conn.execute(
            'SELECT username, humor, nota, texto, created_at FROM moods WHERE couple_code=? ORDER BY id DESC LIMIT 60',
            (code,),
        ).fetchall()
        conn.close()
        moods = [{'username': r['username'], 'humor': r['humor'], 'nota': r['nota'], 'texto': r['texto'], 'date': r['created_at']} for r in rows]
        self._json(200, {'ok': True, 'moods': moods})

    # ==================== DIÁRIO: STATS ====================

    def _diary_stats(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        conn = db.get_conn()
        quiz_count = conn.execute('SELECT COUNT(*) c FROM quiz_questions WHERE couple_code=?', (code,)).fetchone()['c']
        answered = conn.execute('SELECT COUNT(DISTINCT question_id) c FROM quiz_answers WHERE couple_code=?', (code,)).fetchone()['c']
        letters_count = conn.execute('SELECT COUNT(*) c FROM letters WHERE couple_code=?', (code,)).fetchone()['c']
        moods_count = conn.execute('SELECT COUNT(*) c FROM moods WHERE couple_code=?', (code,)).fetchone()['c']

        matches = 0
        quizzes_with_answers = conn.execute(
            'SELECT q.id FROM quiz_questions q '
            'JOIN quiz_answers a1 ON a1.question_id=q.id '
            'JOIN quiz_answers a2 ON a2.question_id=q.id AND a2.username != a1.username '
            'WHERE q.couple_code=? GROUP BY q.id',
            (code,),
        ).fetchall()
        for q in quizzes_with_answers:
            a1 = conn.execute('SELECT resposta FROM quiz_answers WHERE question_id=? AND couple_code=? ORDER BY id ASC LIMIT 1', (q['id'], code)).fetchone()
            a2 = conn.execute('SELECT resposta FROM quiz_answers WHERE question_id=? AND couple_code=? ORDER BY id DESC LIMIT 1', (q['id'], code)).fetchone()
            if a1 and a2 and a1['resposta'] == a2['resposta']:
                matches += 1

        sintonia = round((matches / len(quizzes_with_answers)) * 100) if quizzes_with_answers else 0
        conn.close()
        self._json(200, {
            'ok': True,
            'quizzes': quiz_count,
            'quizzes_respondidos': answered,
            'cartas': letters_count,
            'humores': moods_count,
            'sintonia': sintonia,
            'acertos_quiz': matches,
            'total_quiz': len(quizzes_with_answers),
        })

    # ==================== UBER ====================

    def _uber_get_settings(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        conn = db.get_conn()
        row = conn.execute('SELECT data FROM uber_settings WHERE couple_code=?', (code,)).fetchone()
        conn.close()
        if not row:
            return self._json(200, {'ok': True, 'settings': None})
        self._json(200, {'ok': True, 'settings': json.loads(row['data'])})

    def _uber_save_settings(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        body = self._read_json()
        settings = body.get('settings', {})
        conn = db.get_conn()
        conn.execute(
            'INSERT INTO uber_settings (couple_code, data, updated_at) VALUES (?, ?, ?) '
            'ON CONFLICT(couple_code) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at',
            (code, json.dumps(settings, ensure_ascii=False), _now_iso()),
        )
        conn.commit()
        conn.close()
        self._json(200, {'ok': True})

    def _uber_get_sessions(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        conn = db.get_conn()
        rows = conn.execute(
            'SELECT session_id, data FROM uber_sessions WHERE couple_code=? ORDER BY id DESC LIMIT 200',
            (code,),
        ).fetchall()
        conn.close()
        sessions = [{'id': r['session_id'], **json.loads(r['data'])} for r in rows]
        self._json(200, {'ok': True, 'sessions': sessions})

    def _uber_save_session(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        body = self._read_json()
        session_id = body.get('id', '')
        session_data = body.get('session', {})
        if not session_id:
            return self._json(400, {'ok': False, 'error': 'id obrigatório'})
        conn = db.get_conn()
        conn.execute(
            'INSERT INTO uber_sessions (couple_code, session_id, data, created_at) VALUES (?, ?, ?, ?) '
            'ON CONFLICT(couple_code, session_id) DO UPDATE SET data=excluded.data',
            (code, session_id, json.dumps(session_data, ensure_ascii=False), _now_iso()),
        )
        conn.commit()
        conn.close()
        self._json(200, {'ok': True})

    def _uber_get_overrides(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        conn = db.get_conn()
        rows = conn.execute(
            'SELECT date, override_type, reason FROM uber_overrides WHERE couple_code=? ORDER BY date DESC',
            (code,),
        ).fetchall()
        conn.close()
        overrides = [{'date': r['date'], 'overrideType': r['override_type'], 'reason': r['reason']} for r in rows]
        self._json(200, {'ok': True, 'overrides': overrides})

    def _uber_save_override(self):
        claims = self._auth_claims()
        if not claims:
            return self._json(401, {'ok': False, 'error': 'não autenticado'})
        code = claims['couple']
        body = self._read_json()
        date = body.get('date', '')
        override_type = body.get('overrideType', '')
        reason = body.get('reason', '')
        if not date or not override_type:
            return self._json(400, {'ok': False, 'error': 'date e overrideType obrigatórios'})
        if override_type == 'delete':
            conn = db.get_conn()
            conn.execute('DELETE FROM uber_overrides WHERE couple_code=? AND date=?', (code, date))
            conn.commit()
            conn.close()
            return self._json(200, {'ok': True})
        conn = db.get_conn()
        conn.execute(
            'INSERT INTO uber_overrides (couple_code, date, override_type, reason, created_at) VALUES (?, ?, ?, ?, ?) '
            'ON CONFLICT(couple_code, date) DO UPDATE SET override_type=excluded.override_type, reason=excluded.reason',
            (code, date, override_type, reason, _now_iso()),
        )
        conn.commit()
        conn.close()
        self._json(200, {'ok': True})


def _now_iso():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


if __name__ == '__main__':
    db.init_db()
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('', PORT), SyncHandler) as httpd:
        print(f'Servidor rodando em http://localhost:{PORT}')
        print(f'Banco em: {db.DB_PATH}')
        httpd.serve_forever()
