# PDF Tools

Aplicação web para manipulação de PDFs: juntar, organizar, dividir, comprimir e converter para Word. Interface moderna, responsiva e executada no navegador (sem necessidade de servidor para as operações).

## Funcionalidades

- **Juntar & Organizar PDF** — Mesclar vários PDFs em um só ou reorganizar as páginas de um único PDF. Arraste para reordenar; preview em tempo real.
- **Dividir PDF** — Extrair páginas por intervalo ou páginas específicas. Opção de baixar em ZIP.
- **Comprimir PDF** — Reduzir tamanho com controle de qualidade. Preview lado a lado (original vs comprimido) com zoom interativo.
- **PDF para Word** — Converter PDF em documento editável (DOCX) preservando estrutura e formatação.

## Tecnologias

- **Frontend:** React 18, TypeScript, Vite
- **PDF:** pdf-lib, pdfjs-dist
- **Documentos:** docx (geração de DOCX)
- **UI:** CSS customizado, react-icons, ldrs (loading)

## Pré-requisitos

- Node.js 18+
- npm ou yarn

## Instalação

```bash
# Clonar o repositório
git clone https://github.com/<seu-usuario>/PDF-Tools.git
cd PDF-Tools

# Instalar dependências
npm install

# Variáveis de ambiente (opcional)
# Copie .env.example para .env.local e preencha os valores.
# O .env.local não é versionado (está no .gitignore).
# Ex.: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para o contador de usos.
```

## Execução

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview

# Produção (servidor estático na porta 3000)
npm run start
```

## Deploy (Coolify)

O projeto está configurado para deploy no [Coolify](https://coolify.io/) com Nixpacks:

- **Build Pack:** Nixpacks (detecta Node/Vite automaticamente).
- **Ports Exposes:** `3000`.
- **Port Mappings:** `8096:3000` (acesso externo na porta 8096, app escuta em 3000).
- **Base Directory:** `/`.
- O `nixpacks.toml` na raiz define o comando de start e `NODE_ENV=production`.

Após o push, o Coolify faz o build (`npm run build`) e sobe o container com `npm run start`, servindo o app em **http://pdf.flexibase.com.br** (ou o domínio configurado) na porta **8096**.

## Estrutura do projeto

```
src/
├── components/       # Componentes reutilizáveis
│   ├── common/       # Botões, upload, loading
│   ├── Layout/       # Sidebar, layout principal
│   └── PDFViewer/    # Previews de PDF (merge, split, compress)
├── contexts/         # React Context (ex.: contador de usos)
├── pages/            # Páginas das ferramentas (Merge, Split, Compress, Word)
├── services/         # Lógica de PDF (merge, split, compress, pdfToWord)
├── styles/           # Estilos globais
├── types/            # Tipos TypeScript
└── utils/            # Utilitários (thumbnails, etc.)
```

## Limitações

- **Tamanho de arquivo:** PDFs muito grandes podem atingir limites de memória do navegador.
- **PDF para Word:** Texto e estrutura são preservados; imagens embutidas no DOCX dependem da implementação atual.
- **Compressão:** Baseada em reprocessamento de imagens no cliente; resultados variam conforme o PDF.

## Licença

Projeto de código aberto para uso livre.
