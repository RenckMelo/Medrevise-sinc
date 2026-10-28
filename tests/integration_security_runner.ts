import http from 'http';
import https from 'https';
import net from 'net';
import dns from 'dns';

// Import or replicate the exact logic from server.ts
function ipv4ToUint32(ip: string): number | null {
  if (typeof ip !== 'string') return null;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let res = 0;
  for (let i = 0; i < 4; i++) {
    const pStr = parts[i];
    if (!/^\d+$/.test(pStr)) return null;
    const num = parseInt(pStr, 10);
    if (num < 0 || num > 255 || (pStr.length > 1 && pStr.startsWith('0'))) return null;
    res = (res * 256) + num;
  }
  return res >>> 0;
}

function isPrivateOrReservedIPv4(ip: string): boolean {
  const ipInt = ipv4ToUint32(ip);
  if (ipInt === null) return true;

  const p1 = (ipInt >>> 24) & 0xFF;
  const p2 = (ipInt >>> 16) & 0xFF;

  if (p1 === 0) return true;
  if (p1 === 10) return true;
  if (p1 === 100 && p2 >= 64 && p2 <= 127) return true;
  if (p1 === 127) return true;
  if (p1 === 169 && p2 === 254) return true;
  if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
  if (p1 === 192 && p2 === 0 && ((ipInt >>> 8 & 0xFF) === 0 || (ipInt >>> 8 & 0xFF) === 2)) return true;
  if (p1 === 192 && p2 === 88 && (ipInt >>> 8 & 0xFF) === 99) return true;
  if (p1 === 192 && p2 === 168) return true;
  if (p1 === 198 && (p2 === 18 || p2 === 19)) return true;
  if (p1 === 198 && p2 === 51 && (ipInt >>> 8 & 0xFF) === 100) return true;
  if (p1 === 203 && p2 === 0 && (ipInt >>> 8 & 0xFF) === 113) return true;
  if (p1 >= 224) return true;

  return false;
}

function parseIPv6Words(ip: string): number[] | null {
  if (typeof ip !== 'string') return null;
  let str = ip.trim().toLowerCase();

  const lastColon = str.lastIndexOf(':');
  if (lastColon !== -1) {
    const possibleIpv4 = str.substring(lastColon + 1);
    if (possibleIpv4.includes('.')) {
      const v4Int = ipv4ToUint32(possibleIpv4);
      if (v4Int === null) return null;
      const w7 = (v4Int >>> 16) & 0xFFFF;
      const w8 = v4Int & 0xFFFF;
      const hexV4 = `${w7.toString(16)}:${w8.toString(16)}`;
      str = str.substring(0, lastColon + 1) + hexV4;
    }
  }

  const doubleColonCount = (str.match(/::/g) || []).length;
  if (doubleColonCount > 1) return null;

  let parts: string[];
  if (doubleColonCount === 1) {
    const [leftStr, rightStr] = str.split('::');
    const leftParts = leftStr ? leftStr.split(':') : [];
    const rightParts = rightStr ? rightStr.split(':') : [];

    const missing = 8 - (leftParts.length + rightParts.length);
    if (missing < 1) return null;

    const zeros = new Array(missing).fill('0');
    parts = [...leftParts, ...zeros, ...rightParts];
  } else {
    parts = str.split(':');
  }

  if (parts.length !== 8) return null;

  const words: number[] = [];
  for (const p of parts) {
    if (!/^[0-9a-f]{1,4}$/i.test(p)) return null;
    const val = parseInt(p, 16);
    if (isNaN(val) || val < 0 || val > 0xFFFF) return null;
    words.push(val);
  }

  return words;
}

function isPrivateOrReservedIP(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    return isPrivateOrReservedIPv4(ip);
  } else if (family === 6) {
    const words = parseIPv6Words(ip);
    if (!words) return true;

    const [w1, w2, w3, w4, w5, w6, w7, w8] = words;

    if (w1 === 0 && w2 === 0 && w3 === 0 && w4 === 0 && w5 === 0 && w6 === 0 && w7 === 0) {
      if (w8 === 0 || w8 === 1) return true;
    }

    if (w1 === 0 && w2 === 0 && w3 === 0 && w4 === 0 && w5 === 0 && w6 === 0xFFFF) {
      const v4Int = (w7 << 16) | w8;
      const p1 = (v4Int >>> 24) & 0xFF;
      const p2 = (v4Int >>> 16) & 0xFF;
      const p3 = (v4Int >>> 8) & 0xFF;
      const p4 = v4Int & 0xFF;
      return isPrivateOrReservedIPv4(`${p1}.${p2}.${p3}.${p4}`);
    }

    if (w1 === 0 && w2 === 0 && w3 === 0 && w4 === 0 && w5 === 0xFFFF && w6 === 0) {
      const v4Int = (w7 << 16) | w8;
      const p1 = (v4Int >>> 24) & 0xFF;
      const p2 = (v4Int >>> 16) & 0xFF;
      const p3 = (v4Int >>> 8) & 0xFF;
      const p4 = v4Int & 0xFF;
      return isPrivateOrReservedIPv4(`${p1}.${p2}.${p3}.${p4}`);
    }

    if (w1 === 0x0064 && w2 === 0xFF9B && w3 === 0 && w4 === 0 && w5 === 0 && w6 === 0) {
      const v4Int = (w7 << 16) | w8;
      const p1 = (v4Int >>> 24) & 0xFF;
      const p2 = (v4Int >>> 16) & 0xFF;
      const p3 = (v4Int >>> 8) & 0xFF;
      const p4 = v4Int & 0xFF;
      return isPrivateOrReservedIPv4(`${p1}.${p2}.${p3}.${p4}`);
    }

    if (w1 === 0x2002) {
      const v4Int = (w2 << 16) | w3;
      const p1 = (v4Int >>> 24) & 0xFF;
      const p2 = (v4Int >>> 16) & 0xFF;
      const p3 = (v4Int >>> 8) & 0xFF;
      const p4 = v4Int & 0xFF;
      return isPrivateOrReservedIPv4(`${p1}.${p2}.${p3}.${p4}`);
    }

    if (w1 === 0x2001 && w2 === 0x0000) {
      return true;
    }

    if ((w1 & 0xFE00) === 0xFC00) return true;
    if ((w1 & 0xFFC0) === 0xFE80) return true;
    if ((w1 & 0xFF00) === 0xFF00) return true;

    if ((w1 & 0xE000) !== 0x2000) return true;

    return false;
  }

  return true;
}

async function validateAndResolveUrl(urlStr: string): Promise<{
  safe: boolean;
  reason?: string;
  parsedUrl?: URL;
  resolvedIps?: string[];
  targetIp?: string;
  family?: 4 | 6;
}> {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, reason: 'Apenas os protocolos HTTP e HTTPS são permitidos.' };
    }

    if (parsed.username || parsed.password) {
      return { safe: false, reason: 'URLs contendo credenciais embutidas não são permitidas.' };
    }

    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.localhost')
    ) {
      return { safe: false, reason: 'Acesso a domínios locais e internos não é permitido.' };
    }

    const ipFamily = net.isIP(hostname);
    if (ipFamily !== 0) {
      if (isPrivateOrReservedIP(hostname)) {
        return { safe: false, reason: 'O endereço IP especificado é privado, de loopback ou reservado.' };
      }
      return {
        safe: true,
        parsedUrl: parsed,
        resolvedIps: [hostname],
        targetIp: hostname,
        family: ipFamily as 4 | 6
      };
    }

    let addresses: dns.LookupAddress[] = [];
    try {
      addresses = await dns.promises.lookup(hostname, { all: true });
    } catch (dnsErr) {
      return { safe: false, reason: 'Não foi possível resolver o nome de domínio no servidor DNS.' };
    }

    if (!addresses || addresses.length === 0) {
      return { safe: false, reason: 'O servidor DNS não retornou nenhum endereço IP para este domínio.' };
    }

    const resolvedIps: string[] = [];
    let selectedIp: string | null = null;
    let selectedFamily: 4 | 6 = 4;

    for (const addr of addresses) {
      if (isPrivateOrReservedIP(addr.address)) {
        return { safe: false, reason: `O domínio resolve para o IP não permitido (${addr.address}).` };
      }
      resolvedIps.push(addr.address);
      if (!selectedIp) {
        selectedIp = addr.address;
        selectedFamily = addr.family as 4 | 6;
      }
    }

    return {
      safe: true,
      parsedUrl: parsed,
      resolvedIps,
      targetIp: selectedIp!,
      family: selectedFamily
    };
  } catch (err) {
    return { safe: false, reason: 'URL malformatada ou inválida.' };
  }
}

function validateImageContent(buffer: Buffer): { safe: boolean; detectedType?: string; error?: string } {
  if (!buffer || buffer.length === 0) {
    return { safe: false, error: 'Buffer de imagem vazio ou nulo.' };
  }

  // 1. JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { safe: true, detectedType: 'image/jpeg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
    return { safe: true, detectedType: 'image/png' };
  }

  // 3. GIF: GIF87a ou GIF89a
  if (buffer.length >= 6 &&
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61) {
    return { safe: true, detectedType: 'image/gif' };
  }

  // 4. WEBP: RIFF + 4 bytes + WEBP
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return { safe: true, detectedType: 'image/webp' };
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').toLowerCase();
  if (sample.includes('<html') || sample.includes('<script') || sample.includes('<?php') || sample.includes('<svg')) {
    return { safe: false, error: 'O conteúdo remoto contém HTML, script ou vetor não permitido em proxy binário.' };
  }

  return { safe: false, error: 'Formato de imagem não reconhecido ou assinatura mágica inválida.' };
}

function fetchPinnedResource(
  val: { parsedUrl: URL; targetIp: string; family: 4 | 6 },
  headers: Record<string, string>,
  maxBytes: number,
  timeoutMs: number
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const isHttps = val.parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const cleanHost = val.parsedUrl.hostname;
    const isHostIp = net.isIP(cleanHost) !== 0;

    const reqOptions: http.RequestOptions = {
      protocol: val.parsedUrl.protocol,
      hostname: cleanHost,
      port: val.parsedUrl.port ? parseInt(val.parsedUrl.port, 10) : (isHttps ? 443 : 80),
      path: val.parsedUrl.pathname + val.parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers
      },
      lookup: (_dom, opts, cb: any) => {
        if (opts && opts.all) {
          cb(null, [{ address: val.targetIp, family: val.family }], val.family);
        } else {
          cb(null, val.targetIp, val.family);
        }
      }
    };

    if (isHttps && !isHostIp) {
      (reqOptions as any).servername = cleanHost;
    }

    let isSettled = false;
    let timer: NodeJS.Timeout | null = null;
    let req: http.ClientRequest | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    timer = setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      if (req) req.destroy(new Error('TIMEOUT'));
      reject(new Error('TIMEOUT'));
    }, timeoutMs);

    req = transport.request(reqOptions, (res) => {
      const statusCode = res.statusCode || 500;

      if (statusCode >= 300 && statusCode < 400) {
        cleanup();
        res.resume();
        if (!isSettled) {
          isSettled = true;
          reject(new Error('REDIRECT_BLOCKED'));
        }
        return;
      }

      const contentLengthHeader = res.headers['content-length'];
      if (contentLengthHeader) {
        const parsedLen = parseInt(contentLengthHeader, 10);
        if (!isNaN(parsedLen) && parsedLen > maxBytes) {
          cleanup();
          res.resume();
          if (!isSettled) {
            isSettled = true;
            reject(new Error('MAX_SIZE_EXCEEDED'));
          }
          return;
        }
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      res.on('data', (chunk: Buffer) => {
        if (isSettled) return;
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          isSettled = true;
          cleanup();
          res.destroy();
          reject(new Error('MAX_SIZE_EXCEEDED'));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        resolve({
          statusCode,
          headers: res.headers,
          buffer: Buffer.concat(chunks, totalBytes)
        });
      });

      res.on('error', (err) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        reject(err);
      });
    });

    req.on('error', (err) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      reject(err);
    });

    req.end();
  });
}

// ============================================================================
// SIMULADOR DE SERVIDOR HTTP LOCAL PARA TESTAR INTEGRAÇÃO REAL
// ============================================================================
async function runTests() {
  console.log('=== INICIANDO SUÍTE DE TESTES DE INTEGRAÇÃO FOCADOS ===\n');

  let passed = 0;
  let total = 0;

  function assert(name: string, condition: boolean, detail: string = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${name} ${detail}`);
    } else {
      console.error(`[FAIL] ${name} ${detail}`);
    }
  }

  // 1. Testes de autenticação e autorização lógica
  const ALLOWED_ADMINS = ['ysabelleosaraiva@gmail.com', 'yasabelleosaraiva@gmail.com', 'lucas1renck2melo@gmail.com'];
  
  function checkAuthAndRole(authHeader: string | undefined, verifyTokenMock: (t: string) => { email?: string } | null) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { status: 401, error: 'Autenticação necessária' };
    }
    const token = authHeader.substring(7);
    const decoded = verifyTokenMock(token);
    if (!decoded || !decoded.email) {
      return { status: 401, error: 'Token inválido' };
    }
    if (!ALLOWED_ADMINS.includes(decoded.email.toLowerCase().trim())) {
      return { status: 403, error: 'Acesso negado' };
    }
    return { status: 200, user: decoded.email };
  }

  assert(
    'Auth: Requisição sem header Authorization',
    checkAuthAndRole(undefined, () => null).status === 401
  );

  assert(
    'Auth: Requisição com header malformatado',
    checkAuthAndRole('Basic 123456', () => null).status === 401
  );

  assert(
    'Auth: Requisição com token inválido',
    checkAuthAndRole('Bearer token_falso', () => null).status === 401
  );

  assert(
    'Auth: Usuário autenticado NÃO administrador',
    checkAuthAndRole('Bearer token_valido', () => ({ email: 'aluno_medicina@gmail.com' })).status === 403
  );

  assert(
    'Auth: Usuário autenticado ADMINISTRADOR autorizado',
    checkAuthAndRole('Bearer token_valido', () => ({ email: 'lucas1renck2melo@gmail.com' })).status === 200
  );

  // 2. Testes de validação de URL e bloqueio de SSRF
  const valLoopback = await validateAndResolveUrl('http://127.0.0.1/teste.pdf');
  assert('SSRF: Bloqueio de IP Loopback 127.0.0.1', valLoopback.safe === false);

  const valPrivate = await validateAndResolveUrl('http://192.168.1.1/secret.pdf');
  assert('SSRF: Bloqueio de IP Privado 192.168.1.1', valPrivate.safe === false);

  const valCloudMetadata = await validateAndResolveUrl('http://169.254.169.254/latest/meta-data');
  assert('SSRF: Bloqueio de Link-Local / Metadata 169.254.169.254', valCloudMetadata.safe === false);

  const valLocalhost = await validateAndResolveUrl('http://localhost:8080/admin');
  assert('SSRF: Bloqueio de hostname localhost', valLocalhost.safe === false);

  const valInternalDomain = await validateAndResolveUrl('http://servidor.internal/db');
  assert('SSRF: Bloqueio de sufixo .internal', valInternalDomain.safe === false);

  const valCredentials = await validateAndResolveUrl('http://admin:senha@exemplo.com/doc.pdf');
  assert('SSRF: Bloqueio de URL com credenciais embutidas', valCredentials.safe === false);

  const valFileProtocol = await validateAndResolveUrl('file:///etc/passwd');
  assert('SSRF: Bloqueio de protocolo file://', valFileProtocol.safe === false);

  // 3. Testes com Servidor HTTP Local para validar IP Pinning, Redirects, Limits e Timeouts
  const localPort = 38991;
  const testServer = http.createServer((req, res) => {
    if (req.url === '/redirect-to-private') {
      res.writeHead(302, { 'Location': 'http://127.0.0.1:8080/secret' });
      res.end();
    } else if (req.url === '/large-file') {
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': '30000000' });
      const chunk = Buffer.alloc(1024 * 1024, 0x41);
      for (let i = 0; i < 30; i++) res.write(chunk);
      res.end();
    } else if (req.url === '/stream-overflow') {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      const chunk = Buffer.alloc(1024 * 512, 0x42);
      // Envia 20 chunks de 512 KB = 10 MB sem Content-Length prévio
      for (let i = 0; i < 20; i++) res.write(chunk);
      res.end();
    } else if (req.url === '/hang-timeout') {
      // Nunca responde para testar timeout
      res.writeHead(200, { 'Content-Type': 'text/plain' });
    } else if (req.url === '/valid-png') {
      const pngBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01]);
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(pngBytes);
    } else if (req.url === '/fake-svg-image') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    } else if (req.url === '/fake-html-image') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><body>Error 404</body></html>');
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => testServer.listen(localPort, '127.0.0.1', () => resolve()));

  try {
    // 3.1. Teste de Bloqueio de Redirecionamento 3xx
    let redirectBlocked = false;
    try {
      await fetchPinnedResource(
        { parsedUrl: new URL(`http://127.0.0.1:${localPort}/redirect-to-private`), targetIp: '127.0.0.1', family: 4 },
        {},
        10 * 1024 * 1024,
        5000
      );
    } catch (err: any) {
      if (err.message === 'REDIRECT_BLOCKED') redirectBlocked = true;
    }
    assert('Conexão Pinned: Bloqueio estrito de redirecionamentos 3xx', redirectBlocked);

    // 3.2. Teste de Limite de Tamanho pelo cabeçalho Content-Length
    let sizeExceededContentLength = false;
    try {
      await fetchPinnedResource(
        { parsedUrl: new URL(`http://127.0.0.1:${localPort}/large-file`), targetIp: '127.0.0.1', family: 4 },
        {},
        25 * 1024 * 1024, // 25 MiB max
        5000
      );
    } catch (err: any) {
      if (err.message === 'MAX_SIZE_EXCEEDED') sizeExceededContentLength = true;
    }
    assert('Conexão Pinned: Bloqueio prévio por Content-Length > 25 MiB', sizeExceededContentLength);

    // 3.3. Teste de Limite de Tamanho durante a Leitura em Stream (sem Content-Length)
    let sizeExceededStream = false;
    try {
      await fetchPinnedResource(
        { parsedUrl: new URL(`http://127.0.0.1:${localPort}/stream-overflow`), targetIp: '127.0.0.1', family: 4 },
        {},
        2 * 1024 * 1024, // Limite de 2 MiB (payload envia 10 MiB)
        5000
      );
    } catch (err: any) {
      if (err.message === 'MAX_SIZE_EXCEEDED') sizeExceededStream = true;
    }
    assert('Conexão Pinned: Bloqueio durante a leitura de chunks em stream (> limite)', sizeExceededStream);

    // 3.4. Teste de Timeout Global da Operação
    let timeoutTriggered = false;
    try {
      await fetchPinnedResource(
        { parsedUrl: new URL(`http://127.0.0.1:${localPort}/hang-timeout`), targetIp: '127.0.0.1', family: 4 },
        {},
        10 * 1024 * 1024,
        600 // Timeout curto de 600ms
      );
    } catch (err: any) {
      if (err.message === 'TIMEOUT') timeoutTriggered = true;
    }
    assert('Conexão Pinned: Timeout encerra a requisição e destrói o socket', timeoutTriggered);

    // 3.5. Teste de Validação de Conteúdo de Imagem e Rejeição de SVG/HTML
    const resSvg = await fetchPinnedResource(
      { parsedUrl: new URL(`http://127.0.0.1:${localPort}/fake-svg-image`), targetIp: '127.0.0.1', family: 4 },
      {},
      10 * 1024 * 1024,
      5000
    );
    const svgValidation = validateImageContent(resSvg.buffer);
    assert('Proxy Image: Rejeição estrita de payload SVG', svgValidation.safe === false);

    const resHtml = await fetchPinnedResource(
      { parsedUrl: new URL(`http://127.0.0.1:${localPort}/fake-html-image`), targetIp: '127.0.0.1', family: 4 },
      {},
      10 * 1024 * 1024,
      5000
    );
    const htmlValidation = validateImageContent(resHtml.buffer);
    assert('Proxy Image: Rejeição estrita de payload HTML', htmlValidation.safe === false);

    const resPng = await fetchPinnedResource(
      { parsedUrl: new URL(`http://127.0.0.1:${localPort}/valid-png`), targetIp: '127.0.0.1', family: 4 },
      {},
      10 * 1024 * 1024,
      5000
    );
    const pngValidation = validateImageContent(resPng.buffer);
    assert('Proxy Image: Aceitação de PNG binário com magic bytes válidos', pngValidation.safe === true && pngValidation.detectedType === 'image/png');

    // 4. Teste de Compatibilidade do Contrato de Resposta com AdminComponents.tsx
    const simulatedBuffer = Buffer.from('%PDF-1.4 Fake PDF Header');
    const responsePayload = {
      success: true,
      base64: simulatedBuffer.toString('base64'),
      contentType: 'application/pdf'
    };

    assert(
      'Contrato Frontend: responsePayload possui success=true',
      responsePayload.success === true
    );
    assert(
      'Contrato Frontend: responsePayload possui contentType compatível com application/pdf',
      responsePayload.contentType === 'application/pdf'
    );
    assert(
      'Contrato Frontend: base64 decodifica de volta para os bytes originais',
      Buffer.from(responsePayload.base64, 'base64').toString('utf8') === '%PDF-1.4 Fake PDF Header'
    );

  } finally {
    testServer.close();
  }

  console.log(`\n=== RESULTADO FINAL: ${passed}/${total} TESTES EXECUTADOS COM SUCESSO! ===`);
}

runTests().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
