"""DreamCatcher: reusable Python package extracted from DTSC.ipynb.

Public surface:
    from dreamcatcher.preprocess import clean_text
    from dreamcatcher.pipeline import DreamAnalyzer
"""

from dreamcatcher.preprocess import clean_text
from dreamcatcher.pipeline import DreamAnalyzer

__all__ = ["clean_text", "DreamAnalyzer"]
