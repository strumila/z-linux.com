# Deploy checklist — GCP self-host (nginx + certbot)

Supersedes the earlier GitHub-Pages plan. Target: existing GCP compute instance at **`34.129.238.11`**, nginx already in place serving another project.

Sequence matters: DNS → nginx → first deploy → TLS. Don't try to provision the cert before DNS is pointing at the instance.

## 0. One-time: remove GH-Pages artefacts (optional)

These files were from the Pages plan and are now unused:

- [public/CNAME](../public/CNAME) — only GitHub Pages reads this.
- [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) — uses `actions/deploy-pages`; will fail on every push.

You can `rm` both and commit, or leave them (harmless but misleading). The `astro.config.mjs` `site:` value stays — it's only used for canonical URLs and sitemap generation, which works for any host.

## 1. DNS — point `z-linux.com` at the instance

On your domain registrar / DNS host, create:

```
@    A      34.129.238.11
www  A      34.129.238.11
```

(Or CNAME `www` to `z-linux.com.` if your DNS provider supports apex aliases.)

**Verify propagation** before moving on:

```bash
dig +short z-linux.com
dig +short www.z-linux.com
# both should return 34.129.238.11
```

Can take minutes to hours depending on registrar + local resolver cache. Wait.

## 2. nginx — add the server block

On the instance, as a user with sudo:

```bash
# Copy the config from the repo (SCP'd manually, or paste).
sudo cp docs/nginx-z-linux.conf /etc/nginx/sites-available/z-linux.com
sudo ln -s /etc/nginx/sites-available/z-linux.com /etc/nginx/sites-enabled/z-linux.com
sudo mkdir -p /var/www/z-linux.com
sudo chown -R "$(whoami):$(whoami)" /var/www/z-linux.com

sudo nginx -t
sudo systemctl reload nginx
```

*Verify:* `curl -H "Host: z-linux.com" http://localhost/` should return a 404 (no files yet) rather than the default-host page of your other project.

## 3. First deploy — push `dist/` to the instance

From your dev machine:

```bash
# Set these if defaults don't match your setup:
# export REMOTE_USER=someuser
# export REMOTE_HOST=34.129.238.11

./scripts/deploy.sh
```

This runs `npm run build`, then `rsync`s `dist/` to `/var/www/z-linux.com/` on the instance.

*Verify:* open `http://34.129.238.11` (or `http://z-linux.com` if DNS is live) in a browser.

## 4. HTTPS — certbot via Let's Encrypt

Once DNS is pointing at the instance and HTTP is serving successfully, switch to HTTPS. **This should be considered mandatory**, not optional:

- Browsers show mixed / warning UI on HTTP.
- SEO penalizes non-HTTPS.
- Service workers, crypto APIs, the `Permissions-Policy` header, cookies with `Secure` flag, etc. all require a secure context.
- Let's Encrypt is free and auto-renews.

On the instance:

```bash
sudo apt install -y certbot python3-certbot-nginx   # if not present

sudo certbot --nginx -d z-linux.com -d www.z-linux.com
# Answer the prompts (email, agree to TOS).
# Pick option 2 when asked: redirect HTTP -> HTTPS.
```

certbot edits `/etc/nginx/sites-available/z-linux.com` in place, adding `listen 443 ssl;`, cert paths, and a 301 redirect block for :80. Reloads nginx.

**Auto-renewal** is already installed as a systemd timer; verify:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

*Verify:* `curl -I https://z-linux.com/` returns `200 OK` with a valid cert. Browsers show the padlock.

## 5. Enable HTTPS in the Astro config (already correct)

`astro.config.mjs` has `site: 'https://z-linux.com'`. This is the canonical URL for `<link rel="canonical">` and `sitemap.xml` — keeping it as HTTPS is fine even before the cert is live. No change needed.

## 6. Verify end-to-end

- `https://z-linux.com/` — Overview dashboard loads.
- `https://z-linux.com/stability/` — Semplot hydrates.
- `https://z-linux.com/subsystem/drivers/` — drill route works (tests nginx `try_files` fallback).
- Hard-refresh + DevTools network tab: `Cache-Control` headers look right (7d on hashed assets, `no-cache` on HTML/JSON).

## 7. Ongoing deploys

Every time you want to publish changes:

```bash
./scripts/deploy.sh
```

The four cron workflows on GitHub (still running, independent of hosting) will keep committing `data/*.json` updates to `main`. Those commits do NOT auto-deploy — you run `./scripts/deploy.sh` to pick them up. If you want continuous deployment, set up a `git pull` + `npm run build` + `rsync-to-self` cron on the instance (or wire a GitHub Actions workflow with SSH deploy — separate follow-up).

## 8. Pre-launch residuals (same as before)

- [ ] `data/lts-eol.json` has `_review: true` — verify dates against kernel.org.
- [ ] All dummy data files tagged `"_dummy": true`:
      `grep -l '"_dummy"' data/*.json`
- [ ] `fetch-lkml.mjs` and `fetch-cves.mjs` still to be written.
- [ ] `stable_line_age_days` placeholder constant in stability model.

## 9. Account note

Your local `gh` is currently active as `strumila`. Switch back to `john-strumila-mb` for other work:

```bash
gh auth switch -u john-strumila-mb
```
