#!/usr/bin/env python3
import urllib.request
import json
import base64

POKEMON_COUNT = 151
sprites = {}
errors = []

for i in range(1, POKEMON_COUNT + 1):
    try:
        url = f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{i}.png"
        print(f"[{i:3d}/151] Baixando {url}...")
        data = urllib.request.urlopen(url, timeout=10).read()
        sprites[str(i)] = f"data:image/png;base64,{base64.b64encode(data).decode()}"
    except Exception as e:
        errors.append(f"Erro no Pokemon {i}: {e}")
        print(f"  ERRO: {e}")

with open("sprites_base64.json", "w") as f:
    json.dump(sprites, f)

print(f"\nConcluido! {len(sprites)} sprites salvos em sprites_base64.json")
if errors:
    print("Erros encontrados:")
    for e in errors:
        print(f"  {e}")
