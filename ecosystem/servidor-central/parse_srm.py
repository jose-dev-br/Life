#!/usr/bin/env python3
"""
Parser de saves .srm/.sav do Pokemon Fire Red (GBA).
Extrai dados do Pokedex: quais Pokemon foram capturados e vistos.
"""
import struct

TOTAL_POKEMON = 151

# Offsets no Setor 0 (Section ID 0)
SECTOR_SIZE = 0x1000  # 4096 bytes per sector
SECTOR_ID_OFFSET = 0x0FF4  # Sector ID stored at this offset within each sector
CAPTURED_OFFSET = 0x0028   # 49 bytes: Pokedex caught bitfield
SEEN_OFFSET = 0x005C       # 49 bytes: Pokedex seen bitfield
NATIONAL_DEX_OFFSET = 0x001B  # 1 byte: National Dex unlocked flag (0xB9 = unlocked)


def _find_sector_0(data):
    """Find the Sector 0 (Section ID = 0) in the save file."""
    num_sectors = len(data) // SECTOR_SIZE
    for i in range(num_sectors):
        offset = i * SECTOR_SIZE + SECTOR_ID_OFFSET
        if offset + 4 <= len(data):
            sector_id = struct.unpack_from('<I', data, offset)[0]
            if sector_id == 0:
                return i * SECTOR_SIZE
    return 0


def _read_bitfield(data, offset, num_bytes):
    """Read a bitfield and return a set of 1-based Pokemon numbers that are set."""
    result = set()
    for byte_idx in range(min(num_bytes, len(data) - offset)):
        byte_val = data[offset + byte_idx]
        for bit in range(8):
            pokemon_num = byte_idx * 8 + bit + 1
            if pokemon_num > TOTAL_POKEMON:
                break
            if byte_val & (1 << bit):
                result.add(pokemon_num)
    return result


def parse_srm(file_data):
    """
    Parse a .srm/.sav file from RetroArch (Pokemon Fire Red).

    Args:
        file_data: Raw bytes of the save file

    Returns:
        dict with 'capturados', 'vistos', 'national_dex_unlocked'
    """
    if len(file_data) < SECTOR_SIZE:
        raise ValueError(f"Arquivo muito pequeno ({len(file_data)} bytes). Esperado minimo {SECTOR_SIZE} bytes.")

    sector_0_offset = _find_sector_0(file_data)

    national_dex = file_data[sector_0_offset + NATIONAL_DEX_OFFSET]
    national_dex_unlocked = national_dex == 0xB9

    captured = _read_bitfield(file_data, sector_0_offset + CAPTURED_OFFSET, 49)
    seen = _read_bitfield(file_data, sector_0_offset + SEEN_OFFSET, 49)

    return {
        'capturados': sorted(captured),
        'vistos': sorted(seen),
        'national_dex_unlocked': national_dex_unlocked,
        'total_capturados': len(captured),
        'total_vistos': len(seen),
    }


def parse_srm_file(filepath):
    """Parse a .srm file from disk."""
    with open(filepath, 'rb') as f:
        return parse_srm(f.read())
