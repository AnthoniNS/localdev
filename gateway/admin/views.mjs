// gateway/admin/views.mjs — Robust Admin Dashboard using Alpine.js + Tailwind CSS

export function renderAdminPage(user = null) {
  const isAuthenticated = Boolean(user);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LocalDevAI — Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/cdn.min.js"></script>
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
    [x-cloak] { display: none !important; }
  </style>
</head>
<body class="bg-background text-foreground antialiased min-h-screen flex" 
      x-data="adminApp(${isAuthenticated})" x-init="initApp()" x-cloak>

  <!-- Login View -->
  <template x-if="!isAuthenticated">
    <div class="flex-1 flex items-center justify-center p-4">
      <div class="w-full max-w-md bg-card border border-border rounded-lg shadow-lg p-8">
        <div class="text-center mb-8">
          <div class="w-12 h-12 bg-primary text-primary-foreground rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
          </div>
          <h1 class="text-2xl font-bold">LocalDevAI</h1>
          <p class="text-muted-foreground text-sm mt-1">Painel Administrativo</p>
        </div>
        <form @submit.prevent="login($el.username.value, $el.password.value)">
          <div class="space-y-4">
            <div>
              <label class="text-sm font-medium mb-1.5 block">Usuário</label>
              <input name="username" type="text" value="admin" required class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors">
            </div>
            <div>
              <label class="text-sm font-medium mb-1.5 block">Senha</label>
              <input name="password" type="password" required placeholder="••••••••" class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors">
            </div>
            <div x-show="error" x-text="error" class="text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-md"></div>
            <button type="submit" :disabled="loading" class="w-full bg-primary text-primary-foreground font-medium py-2 px-4 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
              <span x-show="loading">Autenticando...</span>
              <span x-show="!loading">Entrar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </template>

  <!-- Dashboard View -->
  <template x-if="isAuthenticated">
    <div class="flex w-full">
      <!-- Sidebar -->
      <aside class="w-64 bg-card border-r border-border flex flex-col min-h-screen">
        <div class="p-6 border-b border-border flex items-center gap-3">
          <div class="w-8 h-8 bg-primary text-primary-foreground rounded-md flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
          </div>
          <span class="font-bold text-lg">LocalDevAI</span>
        </div>
        <nav class="flex-1 p-4 space-y-1">
          <template x-for="item in menuItems" :key="item.id">
            <button @click="fetchData(item.id)" :class="currentView === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'" class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors">
              <span x-html="item.icon"></span>
              <span x-text="item.label"></span>
            </button>
          </template>
        </nav>
        <div class="p-4 border-t border-border">
          <button @click="logout" class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            Sair
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 flex flex-col min-h-screen bg-background">
        <header class="h-16 border-b border-border flex items-center justify-between px-8 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <h2 class="text-lg font-semibold" x-text="menuItems.find(i => i.id === currentView)?.label || 'Dashboard'"></h2>
          <div class="flex items-center gap-4">
            <button @click="toggleTheme" class="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Alternar tema">
              <svg x-show="!isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              <svg x-show="isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            </button>
            <button @click="fetchData(currentView)" :disabled="loading" class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 disabled:opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="loading ? 'animate-spin' : ''"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
              Atualizar
            </button>
          </div>
        </header>

        <div class="flex-1 p-8 overflow-auto">
          <div x-show="loading" class="flex items-center justify-center h-64">
            <svg class="animate-spin h-8 w-8 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          </div>
          <div x-show="error && !loading" class="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg mb-4" x-text="error"></div>

          <!-- Dashboard View -->
          <div x-show="!loading && !error && currentView === 'dashboard'" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="bg-card border border-border rounded-lg p-6"><p class="text-sm font-medium text-muted-foreground">Projetos Ativos</p><p class="text-3xl font-bold mt-2" x-text="data?.counts?.activeProjects || 0"></p></div>
              <div class="bg-card border border-border rounded-lg p-6"><p class="text-sm font-medium text-muted-foreground">Conversas</p><p class="text-3xl font-bold mt-2" x-text="data?.counts?.conversations || 0"></p></div>
              <div class="bg-card border border-border rounded-lg p-6"><p class="text-sm font-medium text-muted-foreground">Memórias</p><p class="text-3xl font-bold mt-2" x-text="data?.counts?.memories || 0"></p></div>
              <div class="bg-card border border-border rounded-lg p-6"><p class="text-sm font-medium text-muted-foreground">Fragmentos RAG</p><p class="text-3xl font-bold mt-2" x-text="data?.counts?.chunks || 0"></p></div>
            </div>
            <div class="bg-card border border-border rounded-lg p-6">
              <h3 class="font-semibold mb-4">Status dos Serviços</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="flex items-center justify-between p-3 bg-muted rounded-md"><span class="text-sm font-medium">SQLite</span><span class="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">Online</span></div>
                <div class="flex items-center justify-between p-3 bg-muted rounded-md"><span class="text-sm font-medium">Redis</span><span class="text-xs font-semibold px-2 py-1 rounded" :class="data?.services?.redis?.connected ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' : 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'" x-text="data?.services?.redis?.connected ? 'Online' : 'Offline'"></span></div>
                <div class="flex items-center justify-between p-3 bg-muted rounded-md"><span class="text-sm font-medium">llama.cpp</span><span class="text-xs font-semibold px-2 py-1 rounded" :class="data?.services?.llamaCpp?.ok ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' : 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'" x-text="data?.services?.llamaCpp?.ok ? 'Online' : 'Offline'"></span></div>
                <div class="flex items-center justify-between p-3 bg-muted rounded-md"><span class="text-sm font-medium">SearXNG</span><span class="text-xs font-semibold px-2 py-1 rounded" :class="data?.services?.searxng?.ok ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' : 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'" x-text="data?.services?.searxng?.ok ? 'Online' : 'Offline'"></span></div>
              </div>
            </div>
          </div>

          <!-- Projects View -->
          <div x-show="!loading && !error && currentView === 'projects'" class="space-y-4">
            <div class="flex justify-between items-center">
              <p class="text-muted-foreground text-sm">Gerencie os projetos e seus prompts individuais.</p>
              <button @click="showProjectModal = 'create'" class="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Novo Projeto
              </button>
            </div>
            <div class="bg-card border border-border rounded-lg overflow-hidden">
              <table class="w-full text-sm text-left">
                <thead class="bg-muted text-muted-foreground font-medium">
                  <tr><th class="px-4 py-3">Nome</th><th class="px-4 py-3">Diretório</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Ações</th></tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <template x-for="p in data?.projects || []" :key="p.id">
                    <tr class="hover:bg-muted/50">
                      <td class="px-4 py-3 font-medium" x-text="p.name"></td>
                      <td class="px-4 py-3 text-muted-foreground font-mono text-xs" x-text="p.work_dir || '-'"></td>
                      <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-1 rounded" :class="p.state === 'active' ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' : 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'" x-text="p.state"></span></td>
                      <td class="px-4 py-3 flex gap-2">
                        <button @click="openProjectChat(p)" class="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1" title="Chat dedicado deste projeto">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Chat
                        </button>
                        <button @click="openEditProject(p)" class="text-xs bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-md font-medium transition-colors">Editar</button>
                        <button @click="deleteProject(p.id)" class="text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 px-3 py-1.5 rounded-md font-medium transition-colors">Excluir</button>
                      </td>
                    </tr>
                  </template>
                  <tr x-show="!data?.projects || data.projects.length === 0"><td colspan="4" class="px-4 py-8 text-center text-muted-foreground">Nenhum projeto encontrado.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Conversations View -->
          <div x-show="!loading && !error && currentView === 'conversations'" class="space-y-4">
            <div class="bg-card border border-border rounded-lg overflow-hidden">
              <table class="w-full text-sm text-left">
                <thead class="bg-muted text-muted-foreground font-medium">
                  <tr><th class="px-4 py-3">Título</th><th class="px-4 py-3">Projeto</th><th class="px-4 py-3">Mensagens</th><th class="px-4 py-3">Ações</th></tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <template x-for="c in data?.conversations || []" :key="c.id">
                    <tr class="hover:bg-muted/50">
                      <td class="px-4 py-3 font-medium" x-text="c.title || 'Conversa'"></td>
                      <td class="px-4 py-3"><span class="text-xs bg-muted px-2 py-1 rounded" x-text="c.project_name || 'Global'"></span></td>
                      <td class="px-4 py-3" x-text="c.message_count"></td>
                      <td class="px-4 py-3">
                        <button @click="openConversation(c.id)" class="text-xs bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-md font-medium transition-colors">Ver Detalhes</button>
                      </td>
                    </tr>
                  </template>
                  <tr x-show="!data?.conversations || data.conversations.length === 0"><td colspan="4" class="px-4 py-8 text-center text-muted-foreground">Nenhuma conversa encontrada.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Memory View -->
          <div x-show="!loading && !error && currentView === 'memory'" class="space-y-4">
            <div class="flex justify-between items-center">
              <p class="text-muted-foreground text-sm">Fatos e regras persistentes.</p>
              <button @click="showMemoryModal = true" class="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Adicionar
              </button>
            </div>
            <div class="bg-card border border-border rounded-lg overflow-hidden">
              <table class="w-full text-sm text-left">
                <thead class="bg-muted text-muted-foreground font-medium">
                  <tr><th class="px-4 py-3">Conteúdo</th><th class="px-4 py-3">Escopo</th><th class="px-4 py-3">Prioridade</th><th class="px-4 py-3">Ações</th></tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <template x-for="m in data?.memories || []" :key="m.id">
                    <tr class="hover:bg-muted/50">
                      <td class="px-4 py-3" x-text="m.content"></td>
                      <td class="px-4 py-3"><span class="text-xs bg-muted px-2 py-1 rounded" x-text="m.scope"></span></td>
                      <td class="px-4 py-3" x-text="m.priority"></td>
                      <td class="px-4 py-3">
                        <button @click="deleteMemoryId = m.id; showDeleteConfirm = true; deleteType = 'memory'" class="text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 px-3 py-1.5 rounded-md font-medium transition-colors">Excluir</button>
                      </td>
                    </tr>
                  </template>
                  <tr x-show="!data?.memories || data.memories.length === 0"><td colspan="4" class="px-4 py-8 text-center text-muted-foreground">Nenhuma memória encontrada.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Knowledge View -->
          <div x-show="!loading && !error && currentView === 'knowledge'" class="space-y-4">
            <div class="flex justify-between items-center">
              <p class="text-muted-foreground text-sm">Gerencie as fontes de documentação para ingestão RAG.</p>
              <button @click="openNewKnowledge()" class="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Nova Fonte
              </button>
            </div>
            <div class="bg-card border border-border rounded-lg overflow-hidden">
              <table class="w-full text-sm text-left">
                <thead class="bg-muted text-muted-foreground font-medium">
                  <tr><th class="px-4 py-3">Nome</th><th class="px-4 py-3">URL</th><th class="px-4 py-3">Estado</th><th class="px-4 py-3">Fragmentos</th><th class="px-4 py-3">Ações</th></tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <template x-for="s in data?.sources || []" :key="s.id">
                    <tr class="hover:bg-muted/50">
                      <td class="px-4 py-3 font-medium" x-text="s.name"></td>
                      <td class="px-4 py-3 text-muted-foreground font-mono text-xs truncate max-w-xs" x-text="s.url"></td>
                      <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-1 rounded" :class="s.state === 'ready' ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' : 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'" x-text="s.state"></span></td>
                      <td class="px-4 py-3" x-text="s.chunk_count || 0"></td>
                      <td class="px-4 py-3 flex gap-2">
                        <button @click="openEditKnowledge(s)" class="text-xs bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-md font-medium transition-colors">Editar</button>
                        <button @click="deleteId = s.id; deleteType = 'knowledge'; showDeleteConfirm = true" class="text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 px-3 py-1.5 rounded-md font-medium transition-colors">Excluir</button>
                      </td>
                    </tr>
                  </template>
                  <tr x-show="!data?.sources || data.sources.length === 0"><td colspan="5" class="px-4 py-8 text-center text-muted-foreground">Nenhuma fonte encontrada.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Catalog View -->
          <div x-show="!loading && !error && currentView === 'catalog'" class="space-y-4">
            <div class="flex justify-between items-center">
              <p class="text-muted-foreground text-sm">Gerencie as referências técnicas estáticas (156+ recursos).</p>
              <div class="flex gap-2">
                <button @click="bulkCatalogAction('enable_all')" class="btn-secondary px-3 py-1.5 rounded-md text-xs font-medium">Ativar Todos</button>
                <button @click="bulkCatalogAction('disable_all')" class="btn-secondary px-3 py-1.5 rounded-md text-xs font-medium">Desativar Todos</button>
                <button @click="openNewCatalog()" class="btn-primary px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Novo
                </button>
              </div>
            </div>
            <div class="bg-card border border-border rounded-lg overflow-hidden">
              <table class="w-full text-sm text-left">
                <thead class="bg-muted text-muted-foreground font-medium">
                  <tr><th class="px-4 py-3">Status</th><th class="px-4 py-3">Nome</th><th class="px-4 py-3">Categoria</th><th class="px-4 py-3">URL Doc</th><th class="px-4 py-3">Ações</th></tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <template x-for="r in data?.resources || []" :key="r.name">
                    <tr class="hover:bg-muted/50">
                      <td class="px-4 py-3">
                        <label class="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" :checked="r.enabled" @change="toggleCatalogItem(r.name)" class="sr-only peer">
                          <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </td>
                      <td class="px-4 py-3 font-medium" x-text="r.name"></td>
                      <td class="px-4 py-3"><span class="text-xs bg-muted px-2 py-1 rounded" x-text="r.category"></span></td>
                      <td class="px-4 py-3 text-muted-foreground font-mono text-xs truncate max-w-xs" x-text="r.documentation_url || '-'"></td>
                      <td class="px-4 py-3 flex gap-2">
                        <button @click="openEditCatalog(r)" class="text-xs bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-md font-medium transition-colors">Editar</button>
                        <button @click="deleteId = r.name; deleteType = 'catalog'; showDeleteConfirm = true" class="text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 px-3 py-1.5 rounded-md font-medium transition-colors">Excluir</button>
                      </td>
                    </tr>
                  </template>
                  <tr x-show="!data?.resources || data.resources.length === 0"><td colspan="5" class="px-4 py-8 text-center text-muted-foreground">Nenhum recurso encontrado.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Chat View -->
          <div x-show="!loading && !error && currentView === 'chat'" class="flex flex-col h-[calc(100vh-8rem)] bg-card border border-border rounded-xl overflow-hidden">
            <div class="flex-1 overflow-y-auto p-4 space-y-4" x-ref="chatContainer">
              <template x-for="msg in chatMessages" :key="msg.id">
                <div class="flex" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
                  <div class="max-w-[85%] rounded-lg p-4 shadow-sm" :class="msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground border border-border'">
                    <div class="text-xs font-semibold mb-1.5 opacity-70 flex items-center gap-1.5">
                      <svg x-show="msg.role === 'user'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <svg x-show="msg.role === 'assistant'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
                      <span x-text="msg.role === 'user' ? 'Você' : 'Assistente (LocalDevAI)'"></span>
                    </div>
                    <!-- Renderizar imagens enviadas -->
                    <template x-if="msg.images && msg.images.length > 0">
                      <div class="flex flex-wrap gap-2 mb-2">
                        <template x-for="(imgUrl, idx) in msg.images" :key="idx">
                          <img :src="imgUrl" class="max-w-[200px] max-h-[200px] rounded-lg border border-border/50 object-cover">
                        </template>
                      </div>
                    </template>
                    <!-- Renderizar texto (string ou array multimodal) -->
                    <pre class="text-sm whitespace-pre-wrap font-sans leading-relaxed" x-text="typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.filter(c => c.type === 'text').map(c => c.text).join(' ') : '')"></pre>
                  </div>
                </div>
              </template>
              <div x-show="chatLoading" class="flex justify-start">
                <div class="bg-muted border border-border rounded-lg p-4 flex items-center gap-3">
                  <svg class="animate-spin h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span class="text-sm text-muted-foreground font-medium">Processando...</span>
                </div>
              </div>
              <div x-show="chatMessages.length === 0 && !chatLoading" class="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <p class="text-sm">Inicie uma conversa para testar a IA local.</p>
              </div>
            </div>
            <div class="border-t border-border p-4 bg-muted/30">
              <div class="flex gap-3 mb-3">
                <select x-model="selectedModel" class="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors">
                  <template x-for="model in availableModels" :key="model.id">
                    <option :value="model.id" x-text="model.id"></option>
                  </template>
                </select>
                <button @click="loadAvailableModels" class="px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors" title="Recarregar modelos">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                </button>
              </div>
              
              <!-- Preview de imagens anexadas -->
              <div x-show="chatImages.length > 0" class="flex gap-2 mb-3 flex-wrap">
                <template x-for="(img, idx) in chatImages" :key="idx">
                  <div class="relative group">
                    <img :src="img.dataUrl" class="w-20 h-20 object-cover rounded-lg border border-border">
                    <button @click="removeChatImage(idx)" class="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      ×
                    </button>
                  </div>
                </template>
              </div>
              
              <form @submit.prevent="sendChatMessage" class="flex gap-3">
                <input type="file" x-ref="chatImageInput" multiple accept="image/*" @change="handleChatImageUpload" class="hidden">
                <button type="button" @click="$refs.chatImageInput.click()" :disabled="chatLoading" class="px-3 py-2.5 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors disabled:opacity-50" title="Anexar imagens">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                </button>
                <input x-model="chatInput" type="text" placeholder="Digite sua mensagem... (Ctrl+V para colar imagens)" 
                       @paste="handleChatPaste"
                       class="flex-1 px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                       :disabled="chatLoading">
                <button type="submit" :disabled="chatLoading || (!chatInput.trim() && chatImages.length === 0)" 
                        class="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all">
                  <span>Enviar</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                </button>
              </form>
            </div>
          </div>

          <!-- Tools View -->
          <div x-show="!loading && !error && currentView === 'tools'" class="space-y-6">
            <div>
              <h3 class="text-lg font-semibold">Ferramentas do Agente</h3>
              <p class="text-sm text-muted-foreground mt-1">Capacidades disponíveis para o modelo executar ações no sistema e na web.</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <template x-for="tool in data?.tools || []" :key="tool.name">
                <div class="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors duration-200">
                  <div class="flex items-center gap-3 mb-3">
                    <div class="p-2 bg-primary/10 text-primary rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    </div>
                    <h4 class="font-semibold text-base font-mono tracking-tight" x-text="tool.name"></h4>
                  </div>
                  
                  <p class="text-sm text-muted-foreground leading-relaxed mb-4" x-text="tool.description"></p>
                  
                  <div class="border-t border-border pt-3">
                    <h5 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Parâmetros</h5>
                    <div class="space-y-2.5">
                      <template x-for="(param, key) in tool.parameters?.properties || {}" :key="key">
                        <div class="flex items-start gap-2.5">
                          <div class="flex items-center gap-1.5 min-w-[110px]">
                            <span class="font-mono text-xs font-medium text-foreground bg-muted px-1.5 py-0.5 rounded" x-text="key"></span>
                            <span x-show="tool.parameters?.required?.includes(key)" class="w-1.5 h-1.5 rounded-full bg-destructive" title="Obrigatório"></span>
                          </div>
                          <span class="text-xs text-muted-foreground leading-snug" x-text="param.description || 'Sem descrição'"></span>
                        </div>
                      </template>
                      <div x-show="!tool.parameters?.properties" class="text-xs text-muted-foreground italic">
                        Nenhum parâmetro necessário.
                      </div>
                    </div>
                  </div>
                </div>
              </template>
              
              <div x-show="!data?.tools || data.tools.length === 0" class="col-span-full text-center text-muted-foreground py-12 bg-card border border-border border-dashed rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3 opacity-50"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                <p>Nenhuma ferramenta configurada.</p>
              </div>
            </div>
          </div>

          <!-- Settings View -->
          <div x-show="!loading && !error && currentView === 'settings'" class="space-y-6">
            <div>
              <h3 class="text-lg font-semibold">Configurações do Ambiente</h3>
              <p class="text-sm text-muted-foreground mt-1">Variáveis de ambiente e configurações atuais do gateway.</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <template x-for="(value, key) in data?.environment || {}" :key="key">
                <div class="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors duration-200">
                  <div class="flex items-center gap-3 mb-2">
                    <div class="p-2 bg-primary/10 text-primary rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    </div>
                    <h4 class="font-semibold text-base capitalize" x-text="key.replace(/([A-Z])/g, ' $1').trim()"></h4>
                  </div>
                  <div class="bg-muted/50 rounded-lg p-3 mt-3">
                    <code class="text-sm font-mono text-foreground break-all" x-text="value"></code>
                  </div>
                </div>
              </template>
            </div>

            <div class="bg-muted/30 border border-border rounded-xl p-5 mt-6">
              <h4 class="text-sm font-semibold mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                Nota sobre Configuração
              </h4>
              <p class="text-sm text-muted-foreground">
                Estas configurações são gerenciadas diretamente pelo arquivo <code class="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">.env</code> na raiz do projeto. 
                Para alterar qualquer valor, edite o arquivo e reinicie o serviço do gateway.
              </p>
            </div>
          </div>

          <!-- Models View -->
          <div x-show="!loading && !error && currentView === 'models'" class="space-y-6">
            <div>
              <h3 class="text-lg font-semibold">Modelos LLM</h3>
              <p class="text-sm text-muted-foreground mt-1">Configuração do backend de inferência local (llama.cpp).</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-card border border-border rounded-xl p-5">
                <div class="flex items-center gap-3 mb-2">
                  <div class="p-2 bg-primary/10 text-primary rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                  </div>
                  <h4 class="font-semibold text-base">Modelo Padrão</h4>
                </div>
                <div class="bg-muted/50 rounded-lg p-3 mt-3">
                  <code class="text-sm font-mono text-foreground" x-text="data?.defaultModel || 'Não configurado'"></code>
                </div>
              </div>

              <div class="bg-card border border-border rounded-xl p-5">
                <div class="flex items-center gap-3 mb-2">
                  <div class="p-2 bg-primary/10 text-primary rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                  </div>
                  <h4 class="font-semibold text-base">Endpoint do Backend</h4>
                </div>
                <div class="bg-muted/50 rounded-lg p-3 mt-3">
                  <code class="text-sm font-mono text-foreground break-all" x-text="data?.baseUrl || 'Não configurado'"></code>
                </div>
              </div>
            </div>

            <div class="bg-card border border-border rounded-xl p-5">
              <h4 class="font-semibold text-base mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                Modelos Disponíveis
              </h4>
              <div x-show="data?.models && data.models.length > 0" class="space-y-2">
                <template x-for="model in data.models" :key="model.name || model.id">
                  <div class="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                    <div>
                      <span class="font-mono text-sm font-medium text-foreground" x-text="model.name || model.id"></span>
                      <span x-show="model.is_default" class="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Padrão</span>
                    </div>
                    <span class="text-xs text-muted-foreground" x-text="model.endpoint || data.baseUrl"></span>
                  </div>
                </template>
              </div>
              <div x-show="!data?.models || data.models.length === 0" class="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg bg-muted/30">
                <p class="text-sm">Nenhum modelo adicional cadastrado. O sistema está utilizando o modelo padrão configurado no backend.</p>
              </div>
            </div>

            <div class="bg-muted/30 border border-border rounded-xl p-5">
              <h4 class="text-sm font-semibold mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                Nota sobre Configuração
              </h4>
              <p class="text-sm text-muted-foreground">
                O modelo e o endpoint são gerenciados pelas variáveis <code class="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">DEFAULT_MODEL</code> e <code class="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">LLAMA_CPP_BASE_URL</code> no arquivo <code class="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">.env</code>.
                Certifique-se de que o servidor llama.cpp esteja em execução no endpoint especificado.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  </template>

  <!-- Modals -->
  <div x-show="showProjectModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" x-cloak>
    <div class="bg-card border border-border rounded-lg shadow-xl w-full max-w-md p-6" @click.away="showProjectModal = null">
      <h3 class="text-lg font-semibold mb-4" x-text="showProjectModal === 'create' ? 'Novo Projeto' : 'Editar Projeto'"></h3>
      <form @submit.prevent="saveProject">
        <div class="space-y-4">
          <div><label class="text-sm font-medium mb-1.5 block">Nome *</label><input x-model="projectForm.name" type="text" required class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"></div>
          <div><label class="text-sm font-medium mb-1.5 block">Diretório</label><input x-model="projectForm.workDir" type="text" class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"></div>
          <div><label class="text-sm font-medium mb-1.5 block">System Prompt</label><textarea x-model="projectForm.systemPrompt" rows="3" class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"></textarea></div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" @click="showProjectModal = null" class="px-4 py-2 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 transition-colors">Cancelar</button>
          <button type="submit" class="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity">Salvar</button>
        </div>
      </form>
    </div>
  </div>

  <div x-show="showMemoryModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" x-cloak>
    <div class="bg-card border border-border rounded-lg shadow-xl w-full max-w-md p-6" @click.away="showMemoryModal = false">
      <h3 class="text-lg font-semibold mb-4">Nova Memória</h3>
      <form @submit.prevent="saveMemory">
        <div class="space-y-4">
          <div><label class="text-sm font-medium mb-1.5 block">Conteúdo *</label><textarea x-model="memoryForm.content" rows="3" required class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"></textarea></div>
          <div><label class="text-sm font-medium mb-1.5 block">Escopo</label>
            <select x-model="memoryForm.scope" class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="project">Projeto</option>
              <option value="global">Global</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" @click="showMemoryModal = false" class="px-4 py-2 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 transition-colors">Cancelar</button>
          <button type="submit" class="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity">Salvar</button>
        </div>
      </form>
    </div>
  </div>

  <div x-show="showKnowledgeModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" x-cloak>
    <div class="bg-card border border-border rounded-lg shadow-xl w-full max-w-md p-6" @click.away="showKnowledgeModal = false">
      <h3 class="text-lg font-semibold mb-4" x-text="knowledgeForm.id ? 'Editar Fonte' : 'Nova Fonte'"></h3>
      <form @submit.prevent="saveKnowledge">
        <div class="space-y-4">
          <div><label class="text-sm font-medium mb-1.5 block">Nome *</label><input x-model="knowledgeForm.name" type="text" required class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"></div>
          <div><label class="text-sm font-medium mb-1.5 block">URL *</label><input x-model="knowledgeForm.url" type="url" required class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"></div>
          <div><label class="text-sm font-medium mb-1.5 block">Descrição</label><textarea x-model="knowledgeForm.description" rows="2" class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"></textarea></div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" @click="showKnowledgeModal = false" class="px-4 py-2 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 transition-colors">Cancelar</button>
          <button type="submit" class="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity">Salvar</button>
        </div>
      </form>
    </div>
  </div>

  <div x-show="showCatalogModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" x-cloak>
    <div class="bg-card border border-border rounded-lg shadow-xl w-full max-w-md p-6" @click.away="showCatalogModal = false">
      <h3 class="text-lg font-semibold mb-4" x-text="catalogForm.originalName ? 'Editar Recurso' : 'Novo Recurso'"></h3>
      <form @submit.prevent="saveCatalog">
        <div class="space-y-4">
          <div><label class="text-sm font-medium mb-1.5 block">Nome *</label><input x-model="catalogForm.name" type="text" required class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"></div>
          <div><label class="text-sm font-medium mb-1.5 block">Categoria *</label><input x-model="catalogForm.category" type="text" required class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"></div>
          <div><label class="text-sm font-medium mb-1.5 block">URL Documentação</label><input x-model="catalogForm.documentation_url" type="url" class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"></div>
          <div><label class="text-sm font-medium mb-1.5 block">URL CDN</label><input x-model="catalogForm.cdn_url" type="url" class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"></div>
          <div><label class="text-sm font-medium mb-1.5 block">Descrição</label><textarea x-model="catalogForm.description" rows="2" class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"></textarea></div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" @click="showCatalogModal = false" class="px-4 py-2 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 transition-colors">Cancelar</button>
          <button type="submit" class="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity">Salvar</button>
        </div>
      </form>
    </div>
  </div>

  <div x-show="showConversationModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" x-cloak>
    <div class="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[80vh] flex flex-col" @click.away="showConversationModal = false">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold" x-text="currentConversation?.title || 'Conversa'"></h3>
        <button @click="showConversationModal = false" class="p-1 hover:bg-muted rounded-md"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      </div>
      <div class="flex-1 overflow-y-auto space-y-3 pr-2">
        <template x-for="m in conversationMessages" :key="m.id">
          <div class="p-3 rounded-md border border-border" :class="m.role === 'user' ? 'bg-primary/5 border-primary/20' : (m.role === 'assistant' ? 'bg-muted' : 'bg-background')">
            <div class="flex justify-between items-center mb-1">
              <span class="text-xs font-semibold uppercase text-muted-foreground" x-text="m.role"></span>
              <span class="text-xs text-muted-foreground" x-text="new Date(m.created_at).toLocaleTimeString()"></span>
            </div>
            <pre class="text-sm whitespace-pre-wrap font-sans" x-text="m.content"></pre>
          </div>
        </template>
        <div x-show="!conversationMessages || conversationMessages.length === 0" class="text-center text-muted-foreground py-8">Nenhuma mensagem.</div>
      </div>
    </div>
  </div>

  <div x-show="showProjectChatModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" x-cloak>
    <div class="bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl h-[85vh] flex flex-col" @click.away="closeProjectChat()">
      <div class="flex items-center justify-between px-5 py-4 border-b border-border">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary/10 text-primary rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
          </div>
          <div>
            <h3 class="text-base font-semibold" x-text="activeProjectChat?.name || 'Chat do Projeto'"></h3>
            <p class="text-xs text-muted-foreground font-mono truncate max-w-md" x-text="activeProjectChat?.work_dir"></p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <select x-model="projectChatModel" class="px-2 py-1 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20">
            <template x-for="model in availableModels" :key="model.id">
              <option :value="model.id" x-text="model.id"></option>
            </template>
          </select>
          <button @click="closeProjectChat()" class="p-1.5 hover:bg-muted rounded-md transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-5 space-y-4" x-ref="projectChatContainer">
        <template x-for="msg in projectChatMessages" :key="msg.id">
          <div class="flex" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
            <div class="max-w-[85%] rounded-lg p-4 shadow-sm" :class="msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground border border-border'">
              <div class="text-xs font-semibold mb-1.5 opacity-70 flex items-center gap-1.5">
                <span x-text="msg.role === 'user' ? 'Você' : 'Assistente'"></span>
              </div>
              <template x-if="msg.images && msg.images.length > 0">
                <div class="flex flex-wrap gap-2 mb-2">
                  <template x-for="(imgUrl, idx) in msg.images" :key="idx">
                    <img :src="imgUrl" class="max-w-[200px] max-h-[200px] rounded border border-border/50 object-cover">
                  </template>
                </div>
              </template>
              <pre class="text-sm whitespace-pre-wrap font-sans leading-relaxed" x-text="typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.filter(c => c.type === 'text').map(c => c.text).join(' ') : '')"></pre>
            </div>
          </div>
        </template>
        <div x-show="projectChatLoading" class="flex justify-start">
          <div class="bg-muted border border-border rounded-lg p-4 flex items-center gap-3">
            <svg class="animate-spin h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span class="text-sm text-muted-foreground font-medium">Processando...</span>
          </div>
        </div>
        <div x-show="projectChatMessages.length === 0 && !projectChatLoading" class="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <p class="text-sm">Inicie uma conversa específica para este projeto.</p>
          <p class="text-xs mt-1">O system prompt individual será aplicado automaticamente.</p>
        </div>
      </div>
      <div class="border-t border-border p-4 bg-muted/30">
        <div x-show="projectChatImages.length > 0" class="flex gap-2 mb-3 flex-wrap">
          <template x-for="(img, idx) in projectChatImages" :key="idx">
            <div class="relative group">
              <img :src="img.dataUrl" class="w-16 h-16 object-cover rounded border border-border">
              <button @click="projectChatImages.splice(idx, 1)" class="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
            </div>
          </template>
        </div>
        <form @submit.prevent="sendProjectChatMessage" class="flex gap-3">
          <input type="file" x-ref="projectChatImageInput" multiple accept="image/*" @change="handleProjectChatImageUpload" class="hidden">
          <button type="button" @click="$refs.projectChatImageInput.click()" :disabled="projectChatLoading" class="px-3 py-2.5 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors disabled:opacity-50" title="Anexar imagens">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          </button>
          <input x-model="projectChatInput" type="text" placeholder="Mensagem para este projeto... (Ctrl+V para colar imagens)" @paste="handleProjectChatPaste" class="flex-1 px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" :disabled="projectChatLoading">
          <button type="submit" :disabled="projectChatLoading || (!projectChatInput.trim() && projectChatImages.length === 0)" class="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all">
            <span>Enviar</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </form>
      </div>
    </div>
  </div>

  <div x-show="showDeleteConfirm" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" x-cloak>
    <div class="bg-card border border-border rounded-lg shadow-xl w-full max-w-sm p-6" @click.away="showDeleteConfirm = false">
      <h3 class="text-lg font-semibold text-destructive mb-2">Confirmar Exclusão</h3>
      <p class="text-sm text-muted-foreground mb-6">Tem certeza que deseja excluir este item? Esta ação é irreversível.</p>
      <div class="flex justify-end gap-2">
        <button @click="showDeleteConfirm = false" class="px-4 py-2 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 transition-colors">Cancelar</button>
        <button @click="executeDelete" class="px-4 py-2 rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity">Excluir</button>
      </div>
    </div>
  </div>

  <script>
    function adminApp(isAuth) {
      return {
        isAuthenticated: isAuth,
        isDark: false,
        currentView: 'dashboard',
        loading: false,
        data: null,
        error: null,
        showProjectModal: null,
        showMemoryModal: false,
        showKnowledgeModal: false,
        showCatalogModal: false,
        showConversationModal: false,
        showDeleteConfirm: false,
        projectForm: { id: null, name: '', workDir: '', systemPrompt: '' },
        memoryForm: { content: '', scope: 'project' },
        knowledgeForm: { id: null, name: '', url: '', description: '' },
        catalogForm: { originalName: null, name: '', category: '', documentation_url: '', cdn_url: '', description: '' },
        chatMessages: [],
        chatInput: '',
        chatLoading: false,
        chatImages: [],
        availableModels: [],
        selectedModel: '',
        currentConversation: null,
        conversationMessages: [],
        showProjectChatModal: false,
        activeProjectChat: null,
        projectChatMessages: [],
        projectChatInput: '',
        projectChatLoading: false,
        projectChatImages: [],
        projectChatModel: '',
        projectChatConversationId: null,
        deleteId: null,
        deleteType: 'project',
        menuItems: [
          { id: 'dashboard', label: 'Dashboard', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>' },
          { id: 'projects', label: 'Projetos', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>' },
          { id: 'conversations', label: 'Conversas', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>' },
          { id: 'memory', label: 'Memória', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>' },
          { id: 'chat', label: 'Chat de Teste', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
          { id: 'knowledge', label: 'Biblioteca RAG', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>' },
          { id: 'catalog', label: 'Catálogo Técnico', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
          { id: 'models', label: 'Modelos LLM', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>' },
          { id: 'tools', label: 'Ferramentas', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>' },
          { id: 'settings', label: 'Configurações', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>' }
        ],

        async initApp() {
          this.isDark = localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
          this.applyTheme();
          if (this.isAuthenticated) {
            await this.fetchData('dashboard');
            await this.loadAvailableModels();
          }
        },

        async loadAvailableModels() {
          try {
            const res = await fetch('/v1/models');
            if (res.ok) {
              const data = await res.json();
              this.availableModels = data.data || [];
              if (this.availableModels.length > 0 && !this.selectedModel) {
                this.selectedModel = this.availableModels[0].id;
              }
            }
          } catch (e) {
            console.error('Erro ao carregar modelos:', e);
          }
        },

        handleChatImageUpload(event) {
          const files = Array.from(event.target.files);
          files.forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (e) => {
              this.chatImages.push({
                dataUrl: e.target.result,
                name: file.name,
                type: file.type
              });
            };
            reader.readAsDataURL(file);
          });
          event.target.value = '';
        },

        handleChatPaste(event) {
          const items = event.clipboardData?.items;
          if (!items) return;
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              event.preventDefault();
              const file = item.getAsFile();
              if (!file) continue;
              const reader = new FileReader();
              reader.onload = (e) => {
                this.chatImages.push({
                  dataUrl: e.target.result,
                  name: file.name || 'imagem-colada.png',
                  type: file.type
                });
              };
              reader.readAsDataURL(file);
            }
          }
        },

        removeChatImage(idx) {
          this.chatImages.splice(idx, 1);
        },

        applyTheme() {
          if (this.isDark) document.documentElement.classList.add('dark');
          else document.documentElement.classList.remove('dark');
        },

        toggleTheme() {
          this.isDark = !this.isDark;
          localStorage.setItem('theme', this.isDark ? 'dark' : 'light');
          this.applyTheme();
        },

        async fetchData(view) {
          this.currentView = view;
          if (view === 'chat') {
            this.error = null;
            this.loading = false;
            this.data = null;
            return;
          }
          this.loading = true;
          this.error = null;
          try {
            const endpoint = view === 'knowledge' ? 'knowledge/sources' : view;
            const res = await fetch('/admin/api/' + endpoint);
            if (res.status === 401) { this.isAuthenticated = false; window.location.href = '/admin/login'; return; }
            if (!res.ok) throw new Error('Falha ao carregar dados');
            this.data = await res.json();
          } catch (e) { this.error = e.message; }
          finally { this.loading = false; }
        },

        async login(username, password) {
          this.loading = true; this.error = null;
          try {
            const res = await fetch('/admin/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
            const data = await res.json();
            if (res.ok && data.ok) { this.isAuthenticated = true; window.location.href = '/admin'; }
            else { this.error = data.error || 'Credenciais inválidas'; }
          } catch (e) { this.error = 'Erro de conexão'; }
          finally { this.loading = false; }
        },

        async logout() {
          await fetch('/admin/api/logout', { method: 'POST' });
          this.isAuthenticated = false;
          window.location.href = '/admin/login';
        },

        openEditProject(p) {
          this.projectForm = { id: p.id, name: p.name, workDir: p.workDir || p.work_dir || '', systemPrompt: p.systemPrompt || p.system_prompt || '' };
          this.showProjectModal = 'edit';
        },

        async saveProject() {
          this.loading = true;
          try {
            const method = this.projectForm.id ? 'PUT' : 'POST';
            const url = this.projectForm.id ? '/admin/api/projects/' + this.projectForm.id : '/admin/api/projects';
            const payload = {
              name: this.projectForm.name,
              workDir: this.projectForm.workDir,
              systemPrompt: this.projectForm.systemPrompt
            };
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || 'Erro ao salvar projeto');
            }
            this.showProjectModal = null;
            this.projectForm = { id: null, name: '', workDir: '', systemPrompt: '' };
            await this.fetchData('projects');
          } catch (e) { this.error = e.message; }
          finally { this.loading = false; }
        },

        async deleteProject(id) {
          this.deleteId = id; this.deleteType = 'project'; this.showDeleteConfirm = true;
        },

        async openConversation(id) {
          this.loading = true;
          try {
            const res = await fetch('/admin/api/conversations/' + id);
            const data = await res.json();
            this.currentConversation = data.conversation;
            this.conversationMessages = data.messages || [];
            this.showConversationModal = true;
          } catch (e) { this.error = e.message; }
          finally { this.loading = false; }
        },

        async openProjectChat(project) {
          this.activeProjectChat = project;
          this.projectChatMessages = [];
          this.projectChatInput = '';
          this.projectChatImages = [];
          this.projectChatModel = this.selectedModel || (this.availableModels.length > 0 ? this.availableModels[0].id : 'local-model');
          this.projectChatConversationId = null;
          this.showProjectChatModal = true;

          // Carregar histórico de conversas deste projeto
          try {
            const res = await fetch('/admin/api/conversations?project_id=' + project.id);
            if (res.ok) {
              const data = await res.json();
              const conversations = data.conversations || [];
              if (conversations.length > 0) {
                const latest = conversations[0];
                this.projectChatConversationId = latest.id;
                const msgRes = await fetch('/admin/api/conversations/' + latest.id);
                if (msgRes.ok) {
                  const msgData = await msgRes.json();
                  this.projectChatMessages = (msgData.messages || []).map(m => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    images: []
                  }));
                }
              }
            }
          } catch (e) {
            console.error('Erro ao carregar histórico do projeto:', e);
          }
        },

        closeProjectChat() {
          this.showProjectChatModal = false;
          this.activeProjectChat = null;
          this.projectChatMessages = [];
          this.projectChatInput = '';
          this.projectChatImages = [];
          this.projectChatConversationId = null;
        },

        handleProjectChatImageUpload(event) {
          const files = Array.from(event.target.files);
          files.forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (e) => {
              this.projectChatImages.push({
                dataUrl: e.target.result,
                name: file.name,
                type: file.type
              });
            };
            reader.readAsDataURL(file);
          });
          event.target.value = '';
        },

        handleProjectChatPaste(event) {
          const items = event.clipboardData?.items;
          if (!items) return;
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              event.preventDefault();
              const file = item.getAsFile();
              if (!file) continue;
              const reader = new FileReader();
              reader.onload = (e) => {
                this.projectChatImages.push({
                  dataUrl: e.target.result,
                  name: file.name || 'imagem-colada.png',
                  type: file.type
                });
              };
              reader.readAsDataURL(file);
            }
          }
        },

        async sendProjectChatMessage() {
          if ((!this.projectChatInput.trim() && this.projectChatImages.length === 0) || this.projectChatLoading) return;
          if (!this.activeProjectChat) return;

          let userContent;
          if (this.projectChatImages.length > 0) {
            userContent = [];
            if (this.projectChatInput.trim()) {
              userContent.push({ type: 'text', text: this.projectChatInput });
            }
            for (const img of this.projectChatImages) {
              userContent.push({ type: 'image_url', image_url: { url: img.dataUrl } });
            }
          } else {
            userContent = this.projectChatInput;
          }

          const userMsg = {
            role: 'user',
            content: userContent,
            id: Date.now(),
            images: this.projectChatImages.map(i => i.dataUrl)
          };
          this.projectChatMessages.push(userMsg);
          this.projectChatInput = '';
          this.projectChatImages = [];
          this.projectChatLoading = true;

          this.$nextTick(() => {
            if (this.$refs.projectChatContainer) {
              this.$refs.projectChatContainer.scrollTop = this.$refs.projectChatContainer.scrollHeight;
            }
          });

          try {
            const messages = this.projectChatMessages.map(m => {
              if (Array.isArray(m.content)) return { role: m.role, content: m.content };
              return { role: m.role, content: m.content };
            });

            const modelToUse = this.projectChatModel || (this.availableModels.length > 0 ? this.availableModels[0].id : 'local-model');

            const res = await fetch('/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-project-id': this.activeProjectChat.id,
                'x-workspace-folder': this.activeProjectChat.work_dir || ''
              },
              body: JSON.stringify({
                messages: messages,
                model: modelToUse,
                stream: false,
                project_id: this.activeProjectChat.id,
                workspace_folder: this.activeProjectChat.work_dir
              })
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error?.message || 'Falha na resposta da IA');
            }

            const data = await res.json();
            const assistantContent = data.choices?.[0]?.message?.content || 'Sem resposta gerada.';
            this.projectChatMessages.push({ role: 'assistant', content: assistantContent, id: Date.now() + 1 });

            // Capturar conversation_id retornado pelo gateway
            const convId = res.headers.get('x-conversation-id');
            if (convId && !this.projectChatConversationId) {
              this.projectChatConversationId = convId;
            }
          } catch (e) {
            this.projectChatMessages.push({ role: 'assistant', content: 'Erro: ' + e.message, id: Date.now() + 1 });
          } finally {
            this.projectChatLoading = false;
            this.$nextTick(() => {
              if (this.$refs.projectChatContainer) {
                this.$refs.projectChatContainer.scrollTop = this.$refs.projectChatContainer.scrollHeight;
              }
            });
          }
        },

        async saveMemory() {
          this.loading = true;
          try {
            const res = await fetch('/admin/api/memory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.memoryForm) });
            if (!res.ok) throw new Error('Erro ao salvar memória');
            this.showMemoryModal = false;
            this.memoryForm = { content: '', scope: 'project' };
            await this.fetchData('memory');
          } catch (e) { this.error = e.message; }
          finally { this.loading = false; }
        },

        openNewKnowledge() {
          this.knowledgeForm = { id: null, name: '', url: '', description: '' };
          this.showKnowledgeModal = true;
        },

        openEditKnowledge(s) {
          this.knowledgeForm = { id: s.id, name: s.name, url: s.url, description: s.description || '' };
          this.showKnowledgeModal = true;
        },

        openNewCatalog() {
          this.catalogForm = { originalName: null, name: '', category: '', documentation_url: '', cdn_url: '', description: '' };
          this.showCatalogModal = true;
        },

        openEditCatalog(r) {
          this.catalogForm = { originalName: r.name, name: r.name, category: r.category, documentation_url: r.documentation_url || '', cdn_url: r.cdn_url || '', description: r.description || '' };
          this.showCatalogModal = true;
        },

        async saveCatalog() {
          this.loading = true;
          try {
            const method = this.catalogForm.originalName ? 'PUT' : 'POST';
            const resourceName = this.catalogForm.originalName ? encodeURIComponent(this.catalogForm.originalName) : '';
            const url = this.catalogForm.originalName ? '/admin/api/catalog/' + resourceName : '/admin/api/catalog';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.catalogForm) });
            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || 'Erro ao salvar recurso');
            }
            this.showCatalogModal = false;
            this.catalogForm = { originalName: null, name: '', category: '', documentation_url: '', cdn_url: '', description: '' };
            await this.fetchData('catalog');
          } catch (e) { this.error = e.message; }
          finally { this.loading = false; }
        },

        async toggleCatalogItem(name) {
          try {
            const res = await fetch('/admin/api/catalog/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'toggle', names: [name] })
            });
            if (!res.ok) throw new Error('Erro ao alternar recurso');
            await this.fetchData('catalog');
          } catch (e) { this.error = e.message; }
        },

        async bulkCatalogAction(action) {
          try {
            const res = await fetch('/admin/api/catalog/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action })
            });
            if (!res.ok) throw new Error('Erro ao executar ação em massa');
            await this.fetchData('catalog');
            showToast(action === 'enable_all' ? 'Todos os recursos ativados' : 'Todos os recursos desativados', 'success');
          } catch (e) { this.error = e.message; }
        },

        async saveKnowledge() {
          this.loading = true;
          try {
            const method = this.knowledgeForm.id ? 'PUT' : 'POST';
            const url = this.knowledgeForm.id ? '/admin/api/knowledge/sources/' + this.knowledgeForm.id : '/admin/api/knowledge/sources';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.knowledgeForm) });
            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || 'Erro ao salvar fonte');
            }
            this.showKnowledgeModal = false;
            this.knowledgeForm = { id: null, name: '', url: '', description: '' };
            await this.fetchData('knowledge');
          } catch (e) { this.error = e.message; }
          finally { this.loading = false; }
        },

        async executeDelete() {
          this.loading = true;
          try {
            let url = '';
            if (this.deleteType === 'project') url = '/admin/api/projects/' + this.deleteId;
            else if (this.deleteType === 'memory') url = '/admin/api/memory/' + this.deleteId;
            else if (this.deleteType === 'knowledge') url = '/admin/api/knowledge/sources/' + this.deleteId;
            else if (this.deleteType === 'catalog') url = '/admin/api/catalog/' + encodeURIComponent(this.deleteId);
            
            const res = await fetch(url, { method: 'DELETE' });
            if (!res.ok) throw new Error('Erro ao excluir');
            this.showDeleteConfirm = false;
            this.deleteId = null;
            await this.fetchData(this.currentView);
          } catch (e) { this.error = e.message; }
          finally { this.loading = false; }
        },

        async sendChatMessage() {
          if ((!this.chatInput.trim() && this.chatImages.length === 0) || this.chatLoading) return;
          
          // Construir conteúdo da mensagem do usuário
          let userContent;
          if (this.chatImages.length > 0) {
            // Formato multimodal com imagens
            userContent = [];
            if (this.chatInput.trim()) {
              userContent.push({ type: 'text', text: this.chatInput });
            }
            for (const img of this.chatImages) {
              userContent.push({
                type: 'image_url',
                image_url: { url: img.dataUrl }
              });
            }
          } else {
            userContent = this.chatInput;
          }
          
          const userMsg = { role: 'user', content: userContent, id: Date.now(), images: this.chatImages.map(i => i.dataUrl) };
          this.chatMessages.push(userMsg);
          this.chatInput = '';
          this.chatImages = [];
          this.chatLoading = true;

          this.$nextTick(() => {
            if (this.$refs.chatContainer) this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight;
          });

          try {
            // Construir mensagens para a API (converter imagens para formato OpenAI)
            const messages = this.chatMessages.map(m => {
              if (Array.isArray(m.content)) {
                return { role: m.role, content: m.content };
              }
              return { role: m.role, content: m.content };
            });
            
            // Garantir que selectedModel esteja definido
            const modelToUse = this.selectedModel || (this.availableModels.length > 0 ? this.availableModels[0].id : 'local-model');
            
            const res = await fetch('/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: messages,
                model: modelToUse,
                stream: false
              })
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error?.message || 'Falha na resposta da IA');
            }
            
            const data = await res.json();
            const assistantContent = data.choices?.[0]?.message?.content || 'Sem resposta gerada.';
            this.chatMessages.push({ role: 'assistant', content: assistantContent, id: Date.now() + 1 });
          } catch (e) {
            this.chatMessages.push({ role: 'assistant', content: 'Erro: ' + e.message, id: Date.now() + 1 });
          } finally {
            this.chatLoading = false;
            this.$nextTick(() => {
              if (this.$refs.chatContainer) this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight;
            });
          }
        }
      }
    }
  </script>
</body>
</html>`;
}