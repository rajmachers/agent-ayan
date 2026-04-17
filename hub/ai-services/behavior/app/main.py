"""AI Behavior Service - FastAPI Application

Re-exports the FastAPI app from mock-main for demo deployment.
Will be replaced with real ML models when ready.
"""

import sys
import os

# Add parent directory to path so we can import mock-main
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mock_main import app  # noqa: F401, E402

__all__ = ["app"]
