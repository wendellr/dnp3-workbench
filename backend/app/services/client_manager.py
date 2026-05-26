"""
Backward-compatible aliases for the previous client naming.

New code should import from app.services.master_manager.
"""

from app.services.master_manager import MasterManager, master_manager

ClientManager = MasterManager
client_manager = master_manager
