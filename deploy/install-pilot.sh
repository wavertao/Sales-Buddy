#!/usr/bin/env bash
set -euo pipefail
root=/opt/sales-buddy
release="$root/releases/${1:?release id required}"
archive=${2:?code archive required}
snapshot=${3:?snapshot archive required}
test ! -e "$release" || { echo 'Release already exists; refusing overwrite'; exit 1; }
test ! -e "$root/shared/app" || { echo 'Database already exists; use a separately reviewed upgrade'; exit 1; }
mkdir -p "$release" "$root/shared/import"
chmod 700 "$root/backups"
chmod 600 "$archive" "$snapshot"
tar -xzf "$archive" -C "$release"
tar -xzf "$snapshot" -C "$root/shared/import"
export PATH="$root/node/bin:$PATH"
node --input-type=module - "$root/shared/import" <<'JS'
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=process.argv[2],manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
for(const f of manifest.files){const p=path.resolve(root,f.path);if(!p.startsWith(root+'/'))throw Error('Unsafe manifest path');const b=fs.readFileSync(p);if(b.length!==f.bytes||crypto.createHash('sha256').update(b).digest('hex')!==f.sha256)throw Error('Snapshot checksum mismatch');}
console.log('Snapshot manifest verified:',manifest.files.length,'files');
JS
cp -a "$root/shared/import/app" "$root/shared/app"
cp "$root/shared/import/app.env" "$root/shared/app.env"
cp -a "$root/shared/import/knowledge/." "$release/knowledge/"
cp -a "$root/shared/import/assets/." "$release/assets/"
cd "$release"
npm ci --no-audit --no-fund > "$root/shared/npm-install.log" 2>&1
ln -s "$release" "$root/current"
chown -R salesbuddy:salesbuddy "$root/shared"
chmod 700 "$root/shared"
chmod 600 "$root/shared/app.env"
install -m 644 "$release/deploy/sales-buddy.service" /etc/systemd/system/sales-buddy.service
systemctl daemon-reload
systemctl enable --now sales-buddy.service
echo 'Pilot service installed; verify gated health and private data before public ingress.'
