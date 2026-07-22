# Pokemon Fire Red GBA Save File Format - Research

**Date:** 2026-07-21
**Domain:** GBA Save File Format / Pokedex Data Extraction
**Confidence:** HIGH

---

## 1. File Structure Overview

### RetroArch .srm vs .sav

**Key finding:** RetroArch `.srm` files and standard `.sav` files are **interchangeable** for GBA games. They contain identical data — the only difference is the file extension. RetroArch uses `.srm` by default, while mGBA uses `.sav`. Both contain the same 128KB (0x20000 bytes) save data.

> Source: Bulbapedia Gen III save structure documentation, confirmed by multiple converter tools

### Save File Layout (128 KB total)

| Offset | Size | Contents |
|--------|------|----------|
| `0x000000` | 57344 (0xE000) | **Game Save A** — 14 sectors of 4KB each |
| `0x00E000` | 57344 (0xE000) | **Game Save B** — backup/previous save |
| `0x01C000` | 8192 (0x2000) | Hall of Fame data |
| `0x01E000` | 4096 (0x1000) | Mystery Gift / e-Reader |
| `0x01F000` | 4096 (0x1000) | Recorded Battle |

### Sector Structure (each 4KB / 0x1000 bytes)

| Offset (within sector) | Size | Contents |
|------------------------|------|----------|
| `0x0000` | 3968 (0xF80) | Data payload |
| `0x0FF4` | 2 | **Section ID** (identifies what data this sector holds) |
| `0x0FF6` | 2 | Checksum (16-bit) |
| `0x0FF8` | 4 | Signature: `0x08012025` (little-endian: `25 20 01 08`) |
| `0x0FFC` | 4 | Save index (incrementing counter) |

### Section IDs

| ID | Contents |
|----|----------|
| 0 | **Trainer Info + Pokédex** |
| 1 | Team / Items |
| 2 | Game State |
| 3 | Misc Data |
| 4 | Rival Info |
| 5–13 | PC Buffer (Pokémon Storage) |

**Important:** Sectors rotate on each save. The first save writes them as `13, 0, 1, 2, ..., 12`. The next rotates by 1: `12, 13, 0, 1, ..., 11`. You must scan sectors to find Section ID 0.

---

## 2. Pokédex Data — Exact Offsets

### FireRed/LeafGreen Specific Offsets

The Pokédex data lives in **Section 0** (Trainer Info). All offsets below are relative to the **start of Section 0's data payload** (not the sector start, but after sector reconstruction).

| Section | Offset | Size | Contents |
|---------|--------|------|----------|
| 0 | `0x001B` | 1 byte | **National Pokédex A** — `0x00` = locked, `0xB9` = unlocked |
| 0 | `0x0028` | 49 bytes | **Pokédex Owned (Caught)** — bitfield |
| 0 | `0x005C` | 49 bytes | **Pokédex Seen A** — bitfield (primary copy) |
| 1 | `0x05F8` | 49 bytes | **Pokédex Seen B** — bitfield (duplicate) |
| 2 | `0x0068` | 1 byte | **National Pokédex B** |
| 2 | `0x011C` | 2 bytes | **National Pokédex C** — `0x58 0x62` = unlocked |
| 4 | `0x0B98` | 49 bytes | **Pokédex Seen C** — bitfield (duplicate) |

> Source: Bulbapedia "Save data structure (Generation III)" — verified against PKHeX source code

### Why 3 Copies of "Seen" Data?

The game stores "seen" flags in three places (Seen A, Seen B, Seen C). All three must contain identical data. This appears to be related to how the game loads save sections across multiple sectors. For read-only extraction, **only Seen A (Section 0, offset 0x005C) is needed**.

---

## 3. Bitfield Format

### Storage Method

- **1 bit per Pokémon** — each bit indicates whether that Pokémon has been seen or caught
- Pokémon are indexed by **National Pokédex order** (same as in-game)
- Indexing is **0-based**: Bulbasaur = 0, Ivysaur = 1, ..., Mew = 150
- Bits are ordered within bytes from **lowest bit to highest bit**
- 49 bytes × 8 bits/byte = 392 bits capacity (supports up to #392 Pokémon)

### Bit Extraction Formula

To check if Pokémon #N (1-based) has been seen/caught:

```
PokeNum = N - 1                    // Convert to 0-based
byte_index = PokeNum >> 3          // Divide by 8 (or PokeNum // 8)
bit_index = PokeNum & 7            // Modulo 8 (or PokeNum % 8)
is_set = (Data[byte_index] >> bit_index) & 1
```

### C-Style Code

```c
// Check if Pokémon with 1-based national dex number `species` is caught
bool is_caught(uint8_t *caught_data, uint16_t species) {
    int bit = species - 1;           // 0-based index
    return (caught_data[bit >> 3] >> (bit & 7)) & 1;
}

// Check if Pokémon is seen
bool is_seen(uint8_t *seen_data, uint16_t species) {
    int bit = species - 1;
    return (seen_data[bit >> 3] >> (bit & 7)) & 1;
}
```

### Setting a Bit

```c
void set_caught(uint8_t *caught_data, uint16_t species) {
    int bit = species - 1;
    caught_data[bit >> 3] |= (1 << (bit & 7));
}
```

### Example: Bulbasaur (#001)

- PokeNum = 1 - 1 = 0
- byte_index = 0 >> 3 = 0
- bit_index = 0 & 7 = 0
- **Bit 0 of byte 0** (LSB of first byte)

### Example: Charmander (#004)

- PokeNum = 4 - 1 = 3
- byte_index = 3 >> 3 = 0
- bit_index = 3 & 7 = 3
- **Bit 3 of byte 0**

### Example: Mew (#151)

- PokeNum = 151 - 1 = 150
- byte_index = 150 >> 3 = 18
- bit_index = 150 & 7 = 6
- **Bit 6 of byte 18**

### Example: Breloom (#286)

- PokeNum = 286 - 1 = 285
- byte_index = 285 >> 3 = 35
- bit_index = 285 & 7 = 5
- **Bit 5 of byte 35**

---

## 4. Finding Section 0 in the Raw Save File

Since sectors rotate on each save, you cannot assume Section 0 is at a fixed position. Here's the algorithm:

```python
def find_section_0(data: bytes, slot_start: int) -> int:
    """Find the absolute offset of Section 0's data in the save file.
    
    Args:
        data: Full 128KB save file bytes
        slot_start: 0x000000 for Slot A, 0x00E000 for Slot B
    
    Returns:
        Absolute file offset of Section 0's data payload
    """
    for i in range(14):
        sector_offset = slot_start + (i * 0x1000)
        section_id = int.from_bytes(data[sector_offset + 0xFF4:sector_offset + 0xFF6], 'little')
        if section_id == 0:
            return sector_offset  # Data starts at sector start
    return -1
```

### Validating the Active Save Slot

The most recent save has the highest `Save index` value (stored at offset `0x0FFC` in each sector, 4 bytes little-endian). Check the last sector (sector 13) of each slot:

```python
def get_save_index(data: bytes, slot_start: int) -> int:
    """Get the save index for a slot (higher = more recent)."""
    last_sector = slot_start + (13 * 0x1000)
    return int.from_bytes(data[last_sector + 0xFFC:last_sector + 0x1000], 'little')
```

---

## 5. Complete Python Implementation

```python
#!/usr/bin/env python3
"""
Pokemon Fire Red Pokedex Extractor
Reads .sav or .srm files and extracts Pokedex seen/caught data.
"""
import struct
from pathlib import Path

# Constants
SECTOR_SIZE = 0x1000          # 4096 bytes per sector
SECTORS_PER_SLOT = 14
SLOT_A_START = 0x000000
SLOT_B_START = 0x00E000
SECTOR_DATA_SIZE = 0xF80      # 3968 bytes of payload per sector
SIGNATURE = 0x08012025         # Magic number (little-endian: 25 20 01 08)

# FireRed Pokedex offsets (within Section 0 data payload)
NATIONAL_DEX_UNLOCKED_OFFSET = 0x001B   # 1 byte: 0x00 or 0xB9
CAUGHT_OFFSET = 0x0028                   # 49 bytes bitfield
SEEN_A_OFFSET = 0x005C                   # 49 bytes bitfield (primary)

# For reference: other Pokedex locations
SEEN_B_SECTION = 1
SEEN_B_OFFSET = 0x05F8                    # 49 bytes
SEEN_C_SECTION = 4
SEEN_C_OFFSET = 0x0B98                    # 49 bytes

POKEMON_PER_BYTE = 8
MAX_DEX_ENTRIES = 49 * 8  # 392 Pokémon max


def calculate_checksum(data: bytes) -> int:
    """Calculate the 16-bit checksum for a sector's data."""
    checksum = 0
    # Process 4 bytes at a time as 32-bit words
    for i in range(0, len(data), 4):
        if i + 3 < len(data):
            word = struct.unpack_from('<I', data, i)[0]
        elif i + 2 < len(data):
            word = struct.unpack_from('<H', data, i)[0] | (data[i+2] << 16)
        elif i + 1 < len(data):
            word = struct.unpack_from('<H', data, i)[0]
        else:
            word = data[i]
        checksum += word
    # Fold 32-bit to 16-bit
    return ((checksum >> 16) + checksum) & 0xFFFF


def find_active_slot(save_data: bytes) -> int:
    """Determine which save slot (A or B) is most recent."""
    idx_a = get_save_index(save_data, SLOT_A_START)
    idx_b = get_save_index(save_data, SLOT_B_START)
    return SLOT_A_START if idx_a >= idx_b else SLOT_B_START


def get_save_index(save_data: bytes, slot_start: int) -> int:
    """Get the save index from the last sector of a slot."""
    last_sector = slot_start + ((SECTORS_PER_SLOT - 1) * SECTOR_SIZE)
    return struct.unpack_from('<I', save_data, last_sector + 0xFFC)[0]


def find_sector(save_data: bytes, slot_start: int, sector_id: int) -> bytes:
    """Find and return the data payload for a given sector ID."""
    for i in range(SECTORS_PER_SLOT):
        offset = slot_start + (i * SECTOR_SIZE)
        sid = struct.unpack_from('<H', save_data, offset + 0xFF4)[0]
        
        if sid == sector_id:
            # Verify signature
            sig = struct.unpack_from('<I', save_data, offset + 0xFF8)[0]
            if sig != SIGNATURE:
                print(f"Warning: Invalid signature in sector {sector_id}")
            
            # Return just the data payload (first 3968 bytes)
            return save_data[offset:offset + SECTOR_DATA_SIZE]
    
    raise ValueError(f"Sector {sector_id} not found in save slot")


def is_pokemon_caught_or_seen(data: bytes, dex_number: int) -> bool:
    """Check if a Pokémon (1-based) is marked in a bitfield."""
    bit = dex_number - 1  # Convert to 0-based
    byte_index = bit >> 3
    bit_index = bit & 7
    if byte_index >= len(data):
        return False
    return (data[byte_index] >> bit_index) & 1 == 1


def extract_pokedex(save_path: str) -> dict:
    """Extract complete Pokedex data from a save file.
    
    Args:
        save_path: Path to .sav or .srm file
    
    Returns:
        Dictionary with caught and seen lists
    """
    path = Path(save_path)
    if not path.exists():
        raise FileNotFoundError(f"Save file not found: {save_path}")
    
    save_data = path.read_bytes()
    file_size = len(save_data)
    
    # Handle different file sizes
    if file_size == 0x20000:  # Standard 128KB
        pass
    elif file_size == 0x10000:  # 64KB (only Slot A)
        pass
    elif file_size > 0x20000:  # Some emulators add extra data (RTC, etc.)
        save_data = save_data[:0x20000]
    else:
        raise ValueError(f"Unexpected file size: {file_size} bytes")
    
    # Find the active save slot
    slot_start = find_active_slot(save_data)
    
    # Get Section 0 (Trainer Info + Pokedex)
    section_0 = find_sector(save_data, slot_start, sector_id=0)
    
    # Verify this is the right section
    if len(section_0) < 0x60:
        raise ValueError("Section 0 data too small")
    
    # Read Pokedex data
    caught_data = section_0[CAUGHT_OFFSET:CAUGHT_OFFSET + 49]
    seen_data = section_0[SEEN_A_OFFSET:SEEN_A_OFFSET + 49]
    
    # Check National Dex unlock status
    national_dex_byte = section_0[NATIONAL_DEX_UNLOCKED_OFFSET]
    national_dex_unlocked = national_dex_byte == 0xB9
    
    # Build results
    caught_pokemon = []
    seen_pokemon = []
    
    for species in range(1, MAX_DEX_ENTRIES + 1):
        if is_pokemon_caught_or_seen(caught_data, species):
            caught_pokemon.append(species)
        if is_pokemon_caught_or_seen(seen_data, species):
            seen_pokemon.append(species)
    
    return {
        'file': str(path.absolute()),
        'file_size': file_size,
        'national_dex_unlocked': national_dex_unlocked,
        'total_caught': len(caught_pokemon),
        'total_seen': len(seen_pokemon),
        'caught': caught_pokemon,
        'seen': seen_pokemon,
        'raw_caught_bytes': caught_data.hex(),
        'raw_seen_bytes': seen_data.hex(),
    }


def print_pokedex_report(result: dict):
    """Print a formatted Pokedex report."""
    print(f"\n{'='*60}")
    print(f"  POKEDEX REPORT")
    print(f"{'='*60}")
    print(f"  File: {result['file']}")
    print(f"  Size: {result['file_size']} bytes")
    print(f"  National Dex: {'Unlocked' if result['national_dex_unlocked'] else 'Locked'}")
    print(f"{'='*60}")
    print(f"  Total Caught: {result['total_caught']}")
    print(f"  Total Seen:   {result['total_seen']}")
    print(f"{'='*60}")
    
    # Show first 151 (Kanto dex)
    print(f"\n  KANTO DEX (#001-#151):")
    print(f"  {'#':<6} {'Name':<15} {'Caught':<10} {'Seen':<10}")
    print(f"  {'-'*41}")
    
    # Pokemon names (Kanto)
    KANTO_NAMES = {
        1: "Bulbasaur", 2: "Ivysaur", 3: "Venusaur",
        4: "Charmander", 5: "Charmeleon", 6: "Charizard",
        7: "Squirtle", 8: "Wartortle", 9: "Blastoise",
        10: "Caterpie", 11: "Metapod", 12: "Butterfree",
        13: "Weedle", 14: "Kakuna", 15: "Beedrill",
        16: "Pidgey", 17: "Pidgeotto", 18: "Pidgeot",
        19: "Rattata", 20: "Raticate", 21: "Spearow",
        22: "Fearow", 23: "Ekans", 24: "Arbok",
        25: "Pikachu", 26: "Raichu", 27: "Sandshrew",
        28: "Sandslash", 29: "Nidoran♀", 30: "Nidorina",
        31: "Nidoqueen", 32: "Nidoran♂", 33: "Nidorino",
        34: "Nidoking", 35: "Clefairy", 36: "Clefable",
        37: "Vulpix", 38: "Ninetales", 39: "Jigglypuff",
        40: "Wigglytuff", 41: "Zubat", 42: "Golbat",
        43: "Oddish", 44: "Gloom", 45: "Vileplume",
        46: "Paras", 47: "Parasect", 48: "Venonat",
        49: "Venomoth", 50: "Diglett", 51: "Dugtrio",
        52: "Meowth", 53: "Persian", 54: "Psyduck",
        55: "Golduck", 56: "Mankey", 57: "Primeape",
        58: "Growlithe", 59: "Arcanine", 60: "Poliwag",
        61: "Poliwhirl", 62: "Poliwrath", 63: "Abra",
        64: "Kadabra", 65: "Alakazam", 66: "Machop",
        67: "Machoke", 68: "Machamp", 69: "Bellsprout",
        70: "Weepinbell", 71: "Victreebel", 72: "Tentacool",
        73: "Tentacruel", 74: "Geodude", 75: "Graveler",
        76: "Golem", 77: "Ponyta", 78: "Rapidash",
        79: "Slowpoke", 80: "Slowbro", 81: "Magnemite",
        82: "Magneton", 83: "Farfetch'd", 84: "Doduo",
        85: "Dodrio", 86: "Seel", 87: "Dewgong",
        88: "Grimer", 89: "Muk", 90: "Shellder",
        91: "Cloyster", 92: "Gastly", 93: "Haunter",
        94: "Gengar", 95: "Onix", 96: "Drowzee",
        97: "Hypno", 98: "Krabby", 99: "Kingler",
        100: "Voltorb", 101: "Electrode", 102: "Exeggcute",
        103: "Exeggutor", 104: "Cubone", 105: "Marowak",
        106: "Hitmonlee", 107: "Hitmonchan", 108: "Lickitung",
        109: "Koffing", 110: "Weezing", 111: "Rhyhorn",
        112: "Rhydon", 113: "Chansey", 114: "Tangela",
        115: "Kangaskhan", 116: "Horsea", 117: "Seadra",
        118: "Goldeen", 119: "Seaking", 120: "Staryu",
        121: "Starmie", 122: "Mr. Mime", 123: "Scyther",
        124: "Jynx", 125: "Electabuzz", 126: "Magmar",
        127: "Pinsir", 128: "Tauros", 129: "Magikarp",
        130: "Gyarados", 131: "Lapras", 132: "Ditto",
        133: "Eevee", 134: "Vaporeon", 135: "Jolteon",
        136: "Flareon", 137: "Porygon", 138: "Omanyte",
        139: "Omastar", 140: "Kabuto", 141: "Kabutops",
        142: "Aerodactyl", 143: "Snorlax", 144: "Articuno",
        145: "Zapdos", 146: "Moltres", 147: "Dratini",
        148: "Dragonair", 149: "Dragonite", 150: "Mewtwo",
        151: "Mew"
    }
    
    for i in range(1, 152):
        name = KANTO_NAMES.get(i, f"#{i}")
        caught = "✓" if i in result['caught'] else " "
        seen = "✓" if i in result['seen'] else " "
        print(f"  #{i:<5} {name:<15} [{caught}]       [{seen}]")
    
    print(f"\n{'='*60}")


# Example usage
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python pokedex_extractor.py <save_file.sav|srm>")
        print("\nThis tool extracts Pokedex data from Pokemon Fire Red save files.")
        sys.exit(1)
    
    result = extract_pokedex(sys.argv[1])
    print_pokedex_report(result)
```

---

## 6. Quick Reference Card

### Essential Offsets for FireRed/LeafGreen

```
FILE STRUCTURE:
  0x000000 - Slot A (14 sectors × 0x1000)
  0x00E000 - Slot B (14 sectors × 0x1000)

SECTOR LAYOUT (each 0x1000 bytes):
  0x0000 - 0x0F7F : Data payload (3968 bytes)
  0x0FF4 - 0x0FF5 : Section ID (2 bytes LE)
  0x0FF6 - 0x0FF7 : Checksum (2 bytes LE)
  0x0FF8 - 0x0FFB : Signature (0x08012025)
  0x0FFC - 0x0FFF : Save index (4 bytes LE)

SECTION 0 (Trainer Info) - Within data payload:
  0x0000 - 0x0006 : Player name (7 bytes, FF-padded)
  0x0008           : Player gender (0=male, 1=female)
  0x000A - 0x000D : Trainer ID (4 bytes, public+secret)
  0x001B           : National Dex unlock (0x00/0xB9)
  0x0028 - 0x0058 : POKEMON CAUGHT (49 bytes bitfield)
  0x005C - 0x008C : POKEMON SEEN A (49 bytes bitfield)

BITFIELD FORMULA:
  species_num = species - 1  (0-based)
  byte = data[species_num >> 3]
  bit = (byte >> (species_num & 7)) & 1
```

### For Kanto Pokemon (1-151)

| Pokemon | Dex# | Byte Index | Bit Position |
|---------|------|------------|--------------|
| Bulbasaur | 1 | 0 | bit 0 |
| Charmander | 4 | 0 | bit 3 |
| Squirtle | 7 | 0 | bit 6 |
| Pikachu | 25 | 3 | bit 0 |
| Mew | 151 | 18 | bit 6 |

---

## 7. Additional Data Points

### National Pokédex Status

| Field | Offset | FireRed Value |
|-------|--------|---------------|
| National Dex A | Section 0, 0x001B | `0x00` = locked, `0xB9` = unlocked |
| National Dex B | Section 2, 0x0068 | Bit 0 indicates status |
| National Dex C | Section 2, 0x011C | `0x00 0x00` = locked, `0x58 0x62` = unlocked |

### Security Key (Money Encryption)

- Location: Section 0, offset `0x0AF8` (4 bytes)
- Money is XORed with this key
- Coins are XORed with lower 2 bytes of this key

---

## 8. Sources

### Primary (HIGH confidence)
- Bulbapedia: [Save data structure (Generation III)](https://bulbapedia.bulbagarden.net/wiki/Save_data_structure_(Generation_III)) — Official documentation with verified offsets
- PKHeX source code: `SAV3.cs` — Open-source save editor with working implementation
- pret/pokefirered: `src/save.c` — Official disassembly with sector handling code

### Secondary (MEDIUM confidence)
- PokeCommunity forums: Fire Red save data structure research thread
- DataCrystal wiki: Gen III RAM map
- Multiple converter tools (srm-to-sav) confirming interchangeability

### Tertiary (LOW confidence)
- Training data knowledge of GBA save formats (verified against primary sources)

---

## 9. Metadata

**Confidence breakdown:**
- File structure: **HIGH** — Bulbapedia is authoritative, verified by multiple tools
- Pokedex offsets: **HIGH** — Bulbapedia table, confirmed by PKHeX implementation
- Bitfield format: **HIGH** — Explicitly documented with formula and examples
- Sector rotation: **HIGH** — Documented in Bulbapedia and source code

**Research date:** 2026-07-21
**Valid until:** Indefinite (stable format, not changing)
