"""Generate a 3D conformer for a PubChem compound that has no PubChem 3D record.

PubChem skips 3D conformers for large or very flexible molecules. This script
takes the PubChem 2D structure, adds hydrogens, embeds with ETKDG (fixed seed,
so the result is reproducible) and relaxes it with MMFF94. Heavy atoms keep
PubChem's order and come before the hydrogens, as build-data.ts expects.

    python scripts/conformer.py 84029 135565674
"""
import sys
import urllib.request
from pathlib import Path

from rdkit import Chem
from rdkit.Chem import AllChem

USER_AGENT = "Chemsisy/0.1 (https://henrycarto.com)"
OUT = Path(__file__).resolve().parent.parent / "data" / "cache" / "sdf-generated"


def main(cids):
    OUT.mkdir(parents=True, exist_ok=True)
    for cid in cids:
        url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/record/SDF?record_type=2d"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        block = urllib.request.urlopen(req, timeout=60).read().decode()
        mol = Chem.MolFromMolBlock(block, removeHs=True)
        mol = Chem.AddHs(mol)
        params = AllChem.ETKDGv3()
        params.randomSeed = 0xC0FFEE
        if AllChem.EmbedMolecule(mol, params) != 0:
            raise SystemExit(f"{cid}: embedding failed")
        AllChem.MMFFOptimizeMolecule(mol, maxIters=2000)
        mol.SetProp("_Name", str(cid))
        (OUT / f"{cid}.sdf").write_text(Chem.MolToMolBlock(mol) + "$$$$\n")
        print(f"{cid}: {mol.GetNumHeavyAtoms()} heavy atoms, {mol.GetNumAtoms()} atoms")


if __name__ == "__main__":
    main(sys.argv[1:])
