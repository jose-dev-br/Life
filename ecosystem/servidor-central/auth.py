"""
auth.py — senha e JWT só com a stdlib (hashlib/hmac/base64), sem pyjwt nem
bcrypt. Formato do hash de senha: pbkdf2_sha256$<iteracoes>$<salt>$<hash>,
mesmo espírito do security.js que já existe pro PIN local.
"""
import hashlib
import hmac
import base64
import json
import os
import time
import secrets

PBKDF2_ITERATIONS = 120_000
JWT_SECRET_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'jwt_secret.key')
JWT_TTL_SECONDS = 30 * 24 * 3600  # 30 dias


def _get_jwt_secret():
    """
    Carrega (ou cria na primeira vez) a chave que assina os tokens. Fica
    guardada em disco -- se for gerada nova a cada restart do container,
    todo mundo é deslogado sempre que o backend reinicia.
    """
    if os.environ.get('JORNADA_JWT_SECRET'):
        return os.environ['JORNADA_JWT_SECRET'].encode('utf-8')
    os.makedirs(os.path.dirname(JWT_SECRET_PATH), exist_ok=True)
    if not os.path.exists(JWT_SECRET_PATH):
        with open(JWT_SECRET_PATH, 'w') as f:
            f.write(secrets.token_hex(32))
    with open(JWT_SECRET_PATH) as f:
        return f.read().strip().encode('utf-8')


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def _b64url_decode(s: str) -> bytes:
    padding = '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + padding)


# ---------- senha ----------

def hash_password(password: str, salt: str = None) -> str:
    salt = salt or secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algo, iterations, salt, expected = stored_hash.split('$')
        if algo != 'pbkdf2_sha256':
            return False
        derived = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), int(iterations))
        return hmac.compare_digest(derived.hex(), expected)
    except (ValueError, AttributeError):
        return False


# ---------- JWT ----------

def jwt_encode(claims: dict) -> str:
    secret = _get_jwt_secret()
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {**claims, "iat": now, "exp": now + JWT_TTL_SECONDS}

    header_b64 = _b64url(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = _b64url(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    signing_input = f"{header_b64}.{payload_b64}".encode('ascii')
    signature = hmac.new(secret, signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url(signature)}"


class JWTError(Exception):
    pass


def jwt_decode(token: str) -> dict:
    secret = _get_jwt_secret()
    try:
        header_b64, payload_b64, sig_b64 = token.split('.')
    except ValueError:
        raise JWTError('formato de token inválido')

    signing_input = f"{header_b64}.{payload_b64}".encode('ascii')
    expected_sig = hmac.new(secret, signing_input, hashlib.sha256).digest()
    given_sig = _b64url_decode(sig_b64)
    if not hmac.compare_digest(expected_sig, given_sig):
        raise JWTError('assinatura inválida')

    payload = json.loads(_b64url_decode(payload_b64))
    if payload.get('exp', 0) < time.time():
        raise JWTError('token expirado')
    return payload


def extract_bearer_token(auth_header: str):
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    return auth_header[len('Bearer '):].strip()
