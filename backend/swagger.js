const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const SPECS = {
  current: {
    title: 'Campus RPG Swagger UI',
    label: '현재 개발된 API',
    filePath: path.join(DOCS_DIR, 'openapi.yaml'),
    yamlPath: '/docs/openapi.yaml',
    docsPath: '/docs/current',
  },
  planned: {
    title: 'Campus RPG Swagger UI (Planned)',
    label: '개발 예정 API',
    filePath: path.join(DOCS_DIR, 'openapi-planned.yaml'),
    yamlPath: '/docs/openapi-planned.yaml',
    docsPath: '/docs/planned',
  },
};

function sendText(res, statusCode, contentType, body) {
  res.status(statusCode).type(contentType).send(body);
}

function readSpecFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function renderDocsIndex() {
  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Campus RPG API 문서</title>
    <style>
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        background: #f5f7fb;
        color: #162033;
      }
      main {
        max-width: 720px;
        margin: 64px auto;
        padding: 0 20px;
      }
      h1 {
        margin-bottom: 12px;
        font-size: 32px;
      }
      p {
        margin-bottom: 28px;
        line-height: 1.6;
      }
      .grid {
        display: grid;
        gap: 16px;
      }
      a.card {
        display: block;
        padding: 20px 22px;
        border-radius: 14px;
        background: #ffffff;
        color: inherit;
        text-decoration: none;
        box-shadow: 0 8px 30px rgba(20, 31, 56, 0.08);
      }
      .title {
        margin: 0 0 6px;
        font-size: 20px;
        font-weight: 700;
      }
      .meta {
        color: #52607a;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Campus RPG API 문서</h1>
      <p>구현된 API 문서와 개발 예정 API 초안을 각각 분리해서 볼 수 있습니다.</p>
      <div class="grid">
        <a class="card" href="${SPECS.current.docsPath}">
          <div class="title">${SPECS.current.label}</div>
          <div class="meta">${SPECS.current.yamlPath}</div>
        </a>
        <a class="card" href="${SPECS.planned.docsPath}">
          <div class="title">${SPECS.planned.label}</div>
          <div class="meta">${SPECS.planned.yamlPath}</div>
        </a>
      </div>
    </main>
  </body>
</html>`;
}

function renderSwaggerHtml(spec) {
  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${spec.title}</title>
    <link
      rel="stylesheet"
      href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
    />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #fafafa;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '${spec.yamlPath}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    </script>
  </body>
</html>`;
}

function registerSwagger(app) {
  app.get('/docs', (_req, res) => {
    sendText(res, 200, 'html', renderDocsIndex());
  });

  app.get(SPECS.current.docsPath, (_req, res) => {
    sendText(res, 200, 'html', renderSwaggerHtml(SPECS.current));
  });

  app.get(SPECS.planned.docsPath, (_req, res) => {
    sendText(res, 200, 'html', renderSwaggerHtml(SPECS.planned));
  });

  app.get(SPECS.current.yamlPath, (_req, res) => {
    try {
      sendText(res, 200, 'application/yaml', readSpecFile(SPECS.current.filePath));
    } catch {
      sendText(
        res,
        500,
        'application/json',
        JSON.stringify({ error: 'OPENAPI_FILE_READ_FAILED' })
      );
    }
  });

  app.get(SPECS.planned.yamlPath, (_req, res) => {
    try {
      sendText(res, 200, 'application/yaml', readSpecFile(SPECS.planned.filePath));
    } catch {
      sendText(
        res,
        500,
        'application/json',
        JSON.stringify({ error: 'OPENAPI_FILE_READ_FAILED' })
      );
    }
  });
}

module.exports = { registerSwagger };
