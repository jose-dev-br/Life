#!/usr/bin/env python3
"""
Seed script — importa backup do banco local para o Codespace.
Uso: python3 seed_db.py
"""
import db
import json
import auth

USERS_DATA = [
    {"couple_code": "ENJS4Q", "username": "Jose", "created_at": "2026-07-19T14:53:54Z"},
    {"couple_code": "ENJS4Q", "username": "Fernanda", "created_at": "2026-07-19T15:00:23Z"},
]

QUIZ_QUESTIONS = [
    {"couple_code": "ENJS4Q", "pergunta": "Qual atividade voc\u00eas mais gostam de fazer juntos?", "opcoes": json.dumps([{"id": "a", "emoji": "\U0001f373", "texto": "Cozinhar"}, {"id": "b", "emoji": "\U0001f3b5", "texto": "Ouvir m\u00fasica"}, {"id": "c", "emoji": "\U0001f6b6", "texto": "Caminhar"}, {"id": "d", "emoji": "\U0001f4fa", "texto": "Assistir s\u00e9rie"}], ensure_ascii=False), "created_at": "2026-07-19T15:38:44Z"},
    {"couple_code": "ENJS4Q", "pergunta": "Se voc\u00eas fossem um casal de filme, qual seria o g\u00eanero?", "opcoes": json.dumps([{"id": "a", "emoji": "\U0001f602", "texto": "Com\u00e9dia rom\u00e2ntica"}, {"id": "b", "emoji": "\U0001f3ac", "texto": "Drama \u00e9pico"}, {"id": "c", "emoji": "", "texto": "Aventura"}, {"id": "d", "emoji": "\u2728", "texto": "Fantasia"}], ensure_ascii=False), "created_at": "2026-07-20T15:25:21Z"},
    {"couple_code": "ENJS4Q", "pergunta": "Qual o melhor jeito de chegar em casa depois do trabalho?", "opcoes": json.dumps([{"id": "a", "emoji": "\U0001f917", "texto": "Um abra\u00e7o demorado"}, {"id": "b", "emoji": "\U0001f37d\ufe0f", "texto": "Jantar juntos"}, {"id": "c", "emoji": "\U0001f6cb\ufe0f", "texto": "Descansar no sof\u00e1"}, {"id": "d", "emoji": "\U0001f4f1", "texto": "Contar o dia"}], ensure_ascii=False), "created_at": "2026-07-21T18:13:09Z"},
]

QUIZ_ANSWERS = [
    {"couple_code": "ENJS4Q", "question_id": 2, "username": "Jose", "resposta": "d", "previsao": "d", "created_at": "2026-07-19T15:38:55Z"},
]

LETTERS = [
    {"couple_code": "ENJS4Q", "from_user": "Jose", "titulo": "", "corpo": "", "lida": 0, "created_at": "2026-07-19T15:35:03Z"},
]

MOODS = [
    {"couple_code": "ENJS4Q", "username": "Jose", "humor": "otimo", "nota": 10, "texto": "Nada a declarar", "created_at": "2026-07-19"},
]

UBER_SETTINGS = [
    {"couple_code": "ENJS4Q", "data": json.dumps({"weeklyNetGoal": 200, "weeklyRent": 590, "fuelPricePerLiter": 3.73, "consumptionKmPerLiter": 12, "averageGrossPerHour": 40, "averageGrossPerPaidKm": 1.1, "restRules": {"minimumSleepHours": 7, "postCltBufferHours": 2, "maximumUberHoursPerDay": 6}, "cltSchedule": {"anchorDate": "2026-07-16", "shiftStart": "18:00", "shiftEnd": "05:00", "patternType": "2x2_3x3", "pattern": []}}, ensure_ascii=False), "updated_at": "2026-07-21T16:37:29Z"},
]


def seed():
    db.init_db()
    conn = db.get_conn()

    try:
        conn.execute("INSERT INTO couples (code, created_at) VALUES (?, ?)", ("ENJS4Q", "2026-07-19T15:53:45Z"))
    except Exception:
        pass

    for u in USERS_DATA:
        try:
            pw_hash = auth.hash_password("1234")
            conn.execute("INSERT INTO users (couple_code, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
                         (u["couple_code"], u["username"], pw_hash, u["created_at"]))
        except Exception:
            pass

    for q in QUIZ_QUESTIONS:
        try:
            conn.execute("INSERT INTO quiz_questions (couple_code, pergunta, opcoes, created_at) VALUES (?, ?, ?, ?)",
                         (q["couple_code"], q["pergunta"], q["opcoes"], q["created_at"]))
        except Exception:
            pass

    for a in QUIZ_ANSWERS:
        try:
            conn.execute("INSERT INTO quiz_answers (couple_code, question_id, username, resposta, previsao, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                         (a["couple_code"], a["question_id"], a["username"], a["resposta"], a["previsao"], a["created_at"]))
        except Exception:
            pass

    for l in LETTERS:
        try:
            conn.execute("INSERT INTO letters (couple_code, from_user, titulo, corpo, lida, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                         (l["couple_code"], l["from_user"], l["titulo"], l["corpo"], l["lida"], l["created_at"]))
        except Exception:
            pass

    for m in MOODS:
        try:
            conn.execute("INSERT INTO moods (couple_code, username, humor, nota, texto, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                         (m["couple_code"], m["username"], m["humor"], m["nota"], m["texto"], m["created_at"]))
        except Exception:
            pass

    for s in UBER_SETTINGS:
        try:
            conn.execute("INSERT INTO uber_settings (couple_code, data, updated_at) VALUES (?, ?, ?)",
                         (s["couple_code"], s["data"], s["updated_at"]))
        except Exception:
            pass

    conn.commit()
    conn.close()
    print("Banco restaurado! Casal ENJS4Q (Jose + Fernanda)")


if __name__ == "__main__":
    seed()
