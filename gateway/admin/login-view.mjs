// gateway/admin/login-view.mjs — Dedicated Login Page

export function renderLoginPage(error = null) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login — LocalDevAI</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'sans-serif'] },
          colors: {
            border: "hsl(var(--border))",
            background: "hsl(var(--background))",
            foreground: "hsl(var(--foreground))",
            primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
            muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
            card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
            destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
          }
        }
      }
    }
  </script>
  <style>
    :root {
      --background: 0 0% 100%; --foreground: 240 10% 3.9%;
      --card: 0 0% 100%; --card-foreground: 240 10% 3.9%;
      --primary: 240 5.9% 10%; --primary-foreground: 0 0% 98%;
      --muted: 240 4.8% 95.9%; --muted-foreground: 240 3.8% 46.1%;
      --border: 240 5.9% 90%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 0 0% 98%;
    }
    .dark {
      --background: 240 10% 3.9%; --foreground: 0 0% 98%;
      --card: 240 10% 3.9%; --card-foreground: 0 0% 98%;
      --primary: 0 0% 98%; --primary-foreground: 240 5.9% 10%;
      --muted: 240 3.7% 15.9%; --muted-foreground: 240 5% 64.9%;
      --border: 240 3.7% 15.9%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 0 0% 98%;
    }
    body { background-color: hsl(var(--background)); color: hsl(var(--foreground)); }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4 relative">
  <!-- Theme Toggle -->
  <button onclick="toggleTheme()" class="absolute top-4 right-4 p-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Alternar tema">
    <svg id="sun-icon" class="w-5 h-5 hidden dark:block" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
    <svg id="moon-icon" class="w-5 h-5 block dark:hidden" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
  </button>

  <!-- Login Card -->
  <div class="w-full max-w-md bg-card border border-border rounded-xl shadow-sm p-8">
    <div class="text-center mb-8">
      <div class="w-12 h-12 bg-primary text-primary-foreground rounded-lg flex items-center justify-center mx-auto mb-4 shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
      </div>
      <h1 class="text-2xl font-bold tracking-tight">LocalDevAI</h1>
      <p class="text-sm text-muted-foreground mt-2">Painel Administrativo</p>
    </div>

    ${error ? `
    <div class="mb-6 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
      <span>${escapeHtml(error)}</span>
    </div>
    ` : ''}

    <form id="login-form" onsubmit="handleLogin(event)" class="space-y-4">
      <div class="space-y-2">
        <label for="username" class="text-sm font-medium leading-none">Usuário</label>
        <input 
          type="text" 
          id="username" 
          name="username"
          value="admin" 
          required 
          autocomplete="username"
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
        >
      </div>
      
      <div class="space-y-2">
        <label for="password" class="text-sm font-medium leading-none">Senha</label>
        <input 
          type="password" 
          id="password" 
          name="password"
          required 
          placeholder="••••••••"
          autocomplete="current-password"
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
        >
      </div>

      <button 
        type="submit" 
        id="submit-btn"
        class="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 mt-6"
      >
        <span id="btn-text">Entrar</span>
        <svg id="btn-icon" class="ml-2 w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
        <svg id="btn-loader" class="hidden ml-2 w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      </button>
    </form>
  </div>

  <script>
    // Theme management
    const isDark = localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');

    function toggleTheme() {
      const isDarkNow = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDarkNow ? 'dark' : 'light');
    }

    async function handleLogin(e) {
      e.preventDefault();
      const btn = document.getElementById('submit-btn');
      const btnText = document.getElementById('btn-text');
      const btnIcon = document.getElementById('btn-icon');
      const btnLoader = document.getElementById('btn-loader');
      
      btn.disabled = true;
      btnText.textContent = 'Autenticando...';
      btnIcon.classList.add('hidden');
      btnLoader.classList.remove('hidden');

      try {
        const res = await fetch('/admin/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
          })
        });

        const data = await res.json();

        if (res.ok && data.ok) {
          window.location.href = '/admin';
        } else {
          throw new Error(data.error || 'Credenciais inválidas');
        }
      } catch (err) {
        window.location.href = '/admin/login?error=' + encodeURIComponent(err.message);
      }
    }
  </script>
</body>
</html>`;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}