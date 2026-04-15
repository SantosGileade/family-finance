# 💰 FinançasFamília · Family Finance

Sistema de controle financeiro familiar com tema escuro, feito com React + Vite + Supabase.

> **Stack:** React 18 · Vite · TailwindCSS · Supabase · Recharts · React Router

---

## 🚀 Como configurar (Setup Guide)

### 1. Crie sua conta no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Crie um **novo projeto** (guarde a senha do banco)
3. Vá em **Settings → API** e copie:
   - `Project URL` → sua `VITE_SUPABASE_URL`  https://yhqxauraiwgvfwonglbf.supabase.co
   - `anon public` key → sua `VITE_SUPABASE_ANON_KEY`  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocXhhdXJhaXdndmZ3b25nbGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjU5NjksImV4cCI6MjA5MTgwMTk2OX0.2LBVbv3vcvyPi98GC8MNVyULUbFsbZQ1yilA-aazRCE

### 2. Crie as tabelas no Supabase

No painel do Supabase, vá em **SQL Editor** e execute este script:

```sql
-- Habilitar RLS (Row Level Security) em todas as tabelas
-- Isso garante que cada usuário só vê seus próprios dados

-- ── PROFILES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  salary NUMERIC DEFAULT 0,
  daily_goal NUMERIC DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can upsert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── INCOME ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS income (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  category TEXT DEFAULT 'salary',
  date DATE NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own income"
  ON income FOR ALL USING (auth.uid() = user_id);

-- ── EXPENSES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL DEFAULT 'variable',
  date DATE NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expenses"
  ON expenses FOR ALL USING (auth.uid() = user_id);

-- ── DAILY SPENDING ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_spending (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE daily_spending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own daily spending"
  ON daily_spending FOR ALL USING (auth.uid() = user_id);

-- ── SAVINGS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS savings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE savings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own savings"
  ON savings FOR ALL USING (auth.uid() = user_id);
```

### 3. Configure o ambiente

```bash
# Clone o repositório
git clone https://github.com/SEU_USUARIO/family-finance.git
cd family-finance

# Instale as dependências
npm install

# Copie o arquivo de exemplo
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais do Supabase:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 4. Configure o Supabase Auth para GitHub Pages

1. No Supabase, vá em **Authentication → URL Configuration**
2. Em **Site URL**, coloque: `https://SEU_USUARIO.github.io/family-finance`
3. Em **Redirect URLs**, adicione: `https://SEU_USUARIO.github.io/family-finance`

### 5. Configure o nome do repositório no Vite

Edite `vite.config.js`:
```js
base: '/family-finance/', // ← troque pelo nome do seu repo
```

### 6. Rode localmente

```bash
npm run dev
```

Acesse: [http://localhost:5173/family-finance/](http://localhost:5173/family-finance/)

---

## 📦 Deploy no GitHub Pages

### Opção A: gh-pages (mais simples)

```bash
# 1. Crie o repositório no GitHub
# 2. Inicialize o git e suba o código:
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/SEU_USUARIO/family-finance.git
git push -u origin main

# 3. Faça o deploy
npm run deploy
```

4. No GitHub, vá em **Settings → Pages** e selecione branch `gh-pages`

### Opção B: GitHub Actions (automático a cada push)

Crie o arquivo `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Em **Settings → Secrets** do repositório, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

---

## 📱 Instalar como App no Celular (PWA)

1. Acesse o site no **Chrome** (Android) ou **Safari** (iPhone)
2. Toque nos 3 pontos (Android) ou no botão de compartilhar (iPhone)
3. Selecione **"Adicionar à tela inicial"**
4. Pronto! Aparece como um app no celular 🎉

---

## ✨ Funcionalidades

| Página | Descrição |
|--------|-----------|
| 🏠 Dashboard | Visão geral, gráficos, alerta de cartão |
| 💵 Renda | Lançar entradas de dinheiro com categorias |
| 🧾 Despesas | Fixas, variáveis e cartão de crédito |
| 📅 Gastos Diários | Calendário, meta de R$ 30/dia |
| 🐷 Poupança | Cofre virtual com marcos e celebrações |
| 💡 Dicas | Educação financeira + vocabulário em inglês |

---

## 🛠️ Tecnologias

- **React 18** + **Vite** — frontend rápido e moderno
- **TailwindCSS** — design responsivo mobile-first
- **Supabase** — banco de dados PostgreSQL + autenticação
- **Recharts** — gráficos bonitos
- **React Router** — navegação
- **date-fns** — manipulação de datas

---

## 🆘 Problemas comuns

**"Tela em branco após login"**
→ Verifique se configurou o Site URL no Supabase Auth

**"Erro de variáveis de ambiente"**
→ Certifique-se que o arquivo `.env` existe e tem as chaves corretas

**"Login não funciona no GitHub Pages"**
→ Adicione a URL do GitHub Pages nos Redirect URLs do Supabase

---

Made with 💚 for family financial freedom!
