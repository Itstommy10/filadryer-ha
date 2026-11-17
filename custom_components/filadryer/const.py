"""Costanti dell'integrazione FilaDryer S4."""

DOMAIN = "filadryer"
NAME = "FilaDryer S4"
VERSION = "1.4.0"

CONF_NOTIFY = "notify_service"

STORAGE_KEY = "filadryer"
STORAGE_VERSION = 1

SIGNAL_UPDATE = "filadryer_update"
EVENT_COMPLETED = "filadryer_completed"

CARD_URL = "/filadryer/filadryer-card.js"

STATUS_IDLE = "idle"
STATUS_DRYING = "drying"
STATUS_DONE = "done"

# Dal manuale SUNLU: id, testo sul display, etichetta, temperatura consigliata, nota
MATERIALS = {
    "PLA": ("PLA", "PLA / PLA+", 48, "45–50 °C"),
    "WOOD": ("WOOD", "WOOD", 48, "45–50 °C"),
    "PETG": ("PETG", "PETG", 53, "50–55 °C"),
    "PVB": ("PVB", "PVB", 53, "50–55 °C"),
    "ABS": ("ABS", "ABS / ABS+", 53, "50–55 °C"),
    "HIPS": ("HIPS", "HIPS", 53, "50–55 °C"),
    "PVA": ("PVA", "PVA", 53, "50–55 °C"),
    "ASA": ("ASA", "ASA", 53, "50–55 °C"),
    "TPU": ("TPU", "TPU", 53, "50–55 °C"),
    "PMMA": ("PMMA", "PMMA", 53, "50–55 °C"),
    "PAPC": ("PA", "PA / PC", 65, "60–70 °C"),
}
UNITS = ["C", "F"]
MODES = ["1", "2"]
LEDS = ["flow", "on", "off"]
LED_LABEL = {"flow": "scorrevole", "on": "sempre acceso", "off": "spento"}

DEFAULT_SETTINGS = {
    "material": "PETG",
    "temperature": 53,
    "unit": "C",
    "hours": 6,
    "mode": "1",
    "humidity": 50,
    "led": "flow",
}

TEMP_MIN, TEMP_MAX = 35, 70
HOURS_MIN, HOURS_MAX = 1, 99
RH_MIN, RH_MAX = 30, 50
