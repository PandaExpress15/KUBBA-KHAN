from pathlib import Path
import hashlib,json
p=Path(__file__).resolve().parent
m=json.loads((p/'SHA256SUMS.json').read_text())
for n,h in m.items():
 assert hashlib.sha256((p/n).read_bytes()).hexdigest()==h,n
print('PASS:',len(m),'verified release files')
