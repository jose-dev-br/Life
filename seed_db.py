#!/usr/bin/env python3
"""
Seed script — importa backup do banco local para o Codespace.
Uso: python3 seed_db.py
"""
import db
import json
import auth
import time

BACKUP = {
    "couples": [
        {"code": "ENJS4Q", "created_at": "2026-07-19T15:53:45Z"},
    ],
    users_data = [
        {"couple_code": "ENJS4Q", "username": "Jose", "created_at": "2026-07-19T14:53:54Z"},
        {"couple_code": "ENJS4Q", "username": "Fernanda", "created_at": "2026-07-19T15:00:23Z"},
    ]
    for u in users_data:
        try:
            pw_hash = auth.hash_password("1234")
            conn.execute("INSERT INTO users (couple_code, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
                         (u["couple_code"], u["username"], pw_hash, u["created_at"]))
        except Exception:
            pass
    "quiz_questions": [
        {"couple_code": "ENJS4Q", "pergunta": "Qual atividade vocês mais gostam de fazer juntos?", "opcoes": json.dumps([{"id": "a", "emoji": "🍳", "texto": "Cozinhar"}, {"id": "b", "emoji": "🎵", "texto": "Ouvir música"}, {"id": "c", "emoji": "🚶", "texto": "Caminhar"}, {"id": "d", "emoji": "📺", "texto": "Assistir série"}], ensure_ascii=False), "created_at": "2026-07-19T15:38:44Z"},
        {"couple_code": "ENJS4Q", "pergunta": "Se vocês fossem um casal de filme, qual seria o gênero?", "opcoes": json.dumps([{"id": "a", "emoji": "😂", "texto": "Comédia romântica"}, {"id": "b", "emoji": "🎬", "texto": "Drama épico"}, {"id": "c", "emoji": "", "texto": "Aventura"}, {"id": "d", "emoji": "✨", "texto": "Fantasia"}], ensure_ascii=False), "created_at": "2026-07-20T15:25:21Z"},
        {"couple_code": "ENJS4Q", "pergunta": "Qual o melhor jeito de chegar em casa depois do trabalho?", "opcoes": json.dumps([{"id": "a", "emoji": "🤗", "texto": "Um abraço demorado"}, {"id": "b", "emoji": "🍽️", "texto": "Jantar juntos"}, {"id": "c", "emoji": "🛋️", "texto": "Descansar no sofá"}, {"id": "d", "emoji": "📱", "texto": "Contar o dia"}], ensure_ascii=False), "created_at": "2026-07-21T18:13:09Z"},
    ],
    "quiz_answers": [
        {"couple_code": "ENJS4Q", "question_id": 2, "username": "Jose", "resposta": "d", "previsao": "d", "created_at": "2026-07-19T15:38:55Z"},
    ],
    "letters": [
        {"couple_code": "ENJS4Q", "from_user": "Jose", "titulo": "", "corpo": "", "lida": 0, "created_at": "2026-07-19T15:35:03Z"},
    ],
    "moods": [
        {"couple_code": "ENJS4Q", "username": "Jose", "humor": "otimo", "nota": 10, "texto": "Nada a declarar", "created_at": "2026-07-19"},
    ],
    "uber_settings": [
        {"couple_code": "ENJS4Q", "data": json.dumps({"weeklyNetGoal": 200, "weeklyRent": 590, "fuelPricePerLiter": 3.73, "consumptionKmPerLiter": 12, "averageGrossPerHour": 40, "averageGrossPerPaidKm": 1.1, "restRules": {"minimumSleepHours": 7, "postCltBufferHours": 2, "maximumUberHoursPerDay": 6}, "cltSchedule": {"anchorDate": "2026-07-16", "shiftStart": "18:00", "shiftEnd": "05:00", "patternType": "2x2_3x3", "pattern": []}}, ensure_ascii=False), "updated_at": "2026-07-21T16:37:29Z"},
    ],
}

def seed():
    db.init_db()
    conn = db.get_conn()

    for c in BACKUP["couples"]:
        try:
            conn.execute("INSERT INTO couples (code, created_at) VALUES (?, ?)", (c["code"], c["created_at"]))
        except Exception:
            pass

    for u in users_data:
        try:
            pw_hash = auth.hash_password("1234")
            conn.execute("INSERT INTO users (couple_code, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
                         (u["couple_code"], u["username"], pw_hash, u["created_at"]))
        except Exception:
            pass

    for q in BACKUP["quiz_questions"]:
        try:
            conn.execute("INSERT INTO quiz_questions (couple_code, pergunta, opcoes, created_at) VALUES (?, ?, ?, ?)",
                         (q["couple_code"], q["pergunta"], q["opcoes"], q["created_at"]))
        except Exception:
            pass

    for a in BACKUP["quiz_answers"]:
        try:
            conn.execute("INSERT INTO quiz_answers (couple_code, question_id, username, resposta, previsao, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                         (a["couple_code"], a["question_id"], a["username"], a["resposta"], a["previsao"], a["created_at"]))
        except Exception:
            pass

    for l in BACKUP["letters"]:
        try:
            conn.execute("INSERT INTO letters (couple_code, from_user, titulo, corpo, lida, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                         (l["couple_code"], l["from_user"], l["titulo"], l["corpo"], l["lida"], l["created_at"]))
        except Exception:
            pass

    for m in BACKUP["moods"]:
        try:
            conn.execute("INSERT INTO moods (couple_code, username, humor, nota, texto, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                         (m["couple_code"], m["username"], m["humor"], m["nota"], m["texto"], m["created_at"]))
        except Exception:
            pass

    for s in BACKUP["uber_settings"]:
        try:
            conn.execute("INSERT INTO uber_settings (couple_code, data, updated_at) VALUES (?, ?, ?)",
                         (s["couple_code"], s["data"], s["updated_at"]))
        except Exception:
            pass

    conn.commit()
    conn.close()
    print("✅ Banco restaurado! Casal ENJS4Q (Jose + Fernanda)")

if __name__ == "__main__":
    seed()
