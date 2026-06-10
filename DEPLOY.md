# Deploy happy-calendar.digitable.life

Push в `master` запускает GitHub Actions, который собирает Vite-приложение и деплоит `dist/` через `rsync` на production.

Схема повторяет `digitable-lol/courses`, но для Vite source directory деплоя — `dist/`, а не `public/`.

## Production path

```bash
DEPLOY_DIR=/www/wwwroot/happy-calendar.digitable.life
mkdir -p "$DEPLOY_DIR"
chown -R githubactionuser:www "$DEPLOY_DIR"
chmod -R u+rwX,g+rwX "$DEPLOY_DIR"
```

## GitHub repository secrets

Нужны те же секреты, что и в `digitable-lol/courses`:

- `DIGITABLE_HOST`
- `DIGITABLE_USERNAME`
- `DIGITABLE_SSH_KEY`

Пример через GitHub CLI:

```bash
gh secret set DIGITABLE_HOST --repo digitable-lol/happy-calendar --body "80.66.72.71"
gh secret set DIGITABLE_USERNAME --repo digitable-lol/happy-calendar --body "githubactionuser"
gh secret set DIGITABLE_SSH_KEY --repo digitable-lol/happy-calendar < /home/githubactionuser/.ssh/id_ed25519
```

Проверка:

```bash
gh secret list --repo digitable-lol/happy-calendar
```

## Manual deploy run

```bash
gh workflow run "Deploy Happy Calendar" --repo digitable-lol/happy-calendar
gh run list --repo digitable-lol/happy-calendar --workflow "Deploy Happy Calendar" --limit 3
```

## Nginx

```nginx
server_name happy-calendar.digitable.life;
root /www/wwwroot/happy-calendar.digitable.life;
index index.html;

location / {
  try_files $uri $uri/ /index.html;
}
```

## Notes

- The workflow skips deployment if secrets are missing.
- It runs `npm install`, `npm test`, and `npm run build` before rsync.
- After adding `package-lock.json`, change the workflow back to `npm ci`.
