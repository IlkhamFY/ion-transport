"""Read the open table. Facts stay a separate file."""
import os
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
OPEN = os.path.join(HERE, "..", "data", "ion_transport_open.parquet")
FACTS = os.path.join(HERE, "..", "data", "ion_transport_facts.parquet")

def load(tier=None, prop=None, ion=None, linked_only=False, measured_only=False, path=None):
    df = pd.read_parquet(path or OPEN)
    if tier:
        df = df[df.tier.isin(list(tier))]
    if prop:
        df = df[df.property == prop]
    if ion:
        df = df[df.ion == ion]
    if linked_only:
        df = df[df.structure_id.notna()]
    if measured_only and "measured_only" in df.columns:
        df = df[df.measured_only.fillna(False)]
    return df.reset_index(drop=True)

def load_facts(path=None):
    return pd.read_parquet(path or FACTS)
